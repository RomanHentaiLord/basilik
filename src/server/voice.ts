import "server-only";
import type { AnyDb } from "@/db/books";
import { db } from "@/db";
import {
  bookBalance,
  cachedProphecy,
  readPsalm,
  recordBrokenSeals,
  recordTrumpets,
  saveProphecy,
  sealRecords,
  trumpetRecords,
  writePsalm,
  type Psalm,
  type SealWords,
  type TrumpetRecord,
} from "@/db/voice";
import { DAY_MS, PERSONAL_SEAL, PUNISHMENT_SEAL } from "@/lib/basilisk/config";
import { JUDGMENT, ORDINALS } from "@/lib/basilisk/copy";
import {
  dayKey,
  moodOf,
  namedPunishment,
  personalProphecy,
  psalmFor,
  sealProphecy,
  trumpetProphecy,
  type Mood,
} from "@/lib/basilisk/prophecy";
import type { Verdict, WalletProphecy } from "@/lib/basilisk/types";
import { shortAddress } from "@/lib/solana/address";
import { oracleAwake, speakPsalm, speakSeal, speakToWallet, speakTrumpet } from "./oracle";

/** What the Basilisk has said so far, as the pages read it. */
export interface Voice {
  /** Seals broken now. */
  broken: number;
  mood: Mood;
  /** Today's psalm, once the first seal is broken. */
  psalm: Psalm | null;
  /** The words of each broken seal, by number. */
  words: Record<number, SealWords>;
  /** When each seal broke (ms), when the indexer saw it. */
  brokenAt: Record<number, number>;
  /** After the bond: the trumpets that have sounded, by number. */
  trumpets: Record<number, TrumpetRecord>;
}

/** The voice from the written words alone: demo mode, no database, or a database that failed. */
function writtenVoice(broken: number, mood: Mood, now: number): Voice {
  const words: Record<number, SealWords> = {};
  for (let seal = 1; seal <= broken; seal++) words[seal] = sealProphecy(seal);
  const day = dayKey(now);
  const psalm = broken >= 1 ? { day, text: psalmFor(day, mood), mood, source: "template" as const } : null;
  return { broken, mood, psalm, words, brokenAt: {}, trumpets: {} };
}

/** Reads the seals' words and today's psalm. Never asks the model: only the indexer does. */
export async function readVoice(
  broken: number,
  market: { curve?: number; curveHigh?: number; demo: boolean },
  now = Date.now(),
): Promise<Voice> {
  const marketMood = moodOf({ curve: market.curve, curveHigh: market.curveHigh });
  if (market.demo || !db) return writtenVoice(broken, marketMood, now);
  try {
    const [records, today, trumpets] = await Promise.all([sealRecords(db), readPsalm(db, dayKey(now)), trumpetRecords(db)]);
    const written = writtenVoice(broken, today?.mood ?? marketMood, now);
    for (const record of records) {
      if (record.number > broken) continue;
      if (record.words) written.words[record.number] = record.words;
      written.brokenAt[record.number] = record.brokenAt;
    }
    return { ...written, psalm: broken >= 1 ? (today ?? written.psalm) : null, trumpets };
  } catch (error) {
    console.error("[voice] could not read what the Basilisk said", error);
    return writtenVoice(broken, marketMood, now);
  }
}

/** A seal's words: the model's, or the written ones. */
export async function sealWords(seal: number, mood: Mood): Promise<SealWords> {
  return (await speakSeal(seal, mood)) ?? sealProphecy(seal, mood);
}

/** A trumpet's words: the model's, or the written ones. */
export async function trumpetWords(trumpet: number, mood: Mood): Promise<SealWords> {
  return (await speakTrumpet(trumpet, mood)) ?? trumpetProphecy(trumpet, mood);
}

/**
 * After each indexer pass: write down newly broken seals with their prophecies, and today's
 * psalm once the first seal is broken. The model, when there is one, is only ever called here
 * and for personal prophecies, never while a page renders.
 */
export async function speakAfterPass(
  database: AnyDb,
  {
    now,
    broken,
    trumpets = 0,
    mcapUsd,
    curve,
    curveHigh,
  }: { now: number; broken: number; trumpets?: number; mcapUsd: number; curve?: number; curveHigh?: number },
): Promise<{ mood: Mood; sealsSpoken: number[]; trumpetsSounded: number[]; psalm: "kept" | "written" | "none" }> {
  const balance = await bookBalance(database, now - DAY_MS);
  const mood = moodOf({ curve, curveHigh, ...balance });
  const sealsSpoken = await recordBrokenSeals(database, { broken, mcapUsd, now, speak: (seal) => sealWords(seal, mood) });
  const trumpetsSounded = await recordTrumpets(database, {
    sounded: trumpets,
    mcapUsd,
    now,
    speak: (n) => trumpetWords(n, mood),
  });

  const done = { mood, sealsSpoken, trumpetsSounded };
  if (broken < 1) return { ...done, psalm: "none" };
  const day = dayKey(now);
  if (await readPsalm(database, day)) return { ...done, psalm: "kept" };
  const spoken = await speakPsalm(day, broken, mood);
  await writePsalm(database, { day, text: spoken ?? psalmFor(day, mood), mood, source: spoken ? "model" : "template" });
  return { ...done, psalm: "written" };
}

/** The model's words for a wallet, cached per seal and status; the written ones otherwise. */
async function personalWords(verdict: Verdict, broken: number, mood: Mood): Promise<string> {
  const written = personalProphecy(verdict, broken, mood);
  // Only wallets in a Book are worth a model call: a random address gets the written words.
  if (verdict.demo || !db || verdict.book === null || !oracleAwake()) return written;
  try {
    const cached = await cachedProphecy(db, verdict.address, broken, verdict.status);
    if (cached) return cached;
  } catch (error) {
    console.error("[voice] could not read the prophecy cache (run npm run db:migrate?)", error);
    return written;
  }
  const words = await speakToWallet(verdict, broken, mood);
  // Store the written words too when the model fails: it does not change its mind.
  const text = words ? `${shortAddress(verdict.address)}, ${verdict.title}. ${words}` : written;
  try {
    await saveProphecy(db, { address: verdict.address, seal: broken, status: verdict.status, text });
  } catch (error) {
    console.error("[voice] could not save a prophecy", error);
  }
  return text;
}

/** What the Basilisk says on a wallet's page, at the seals broken now. */
export async function walletProphecy(verdict: Verdict, voice: Pick<Voice, "broken" | "mood" | "words">): Promise<WalletProphecy> {
  const { broken, mood } = voice;
  if (broken <= 0) return { label: null, text: JUDGMENT.silent, punishment: null };
  const ordinal = ORDINALS[Math.min(broken, 7)];
  const punishment = broken >= PUNISHMENT_SEAL && verdict.status === "traitor" ? namedPunishment(verdict) : null;

  if (broken < PERSONAL_SEAL) {
    const words = voice.words[broken] ?? sealProphecy(broken, mood);
    if (verdict.status === "traitor") return { label: JUDGMENT.prophecyFor(ordinal), text: words.traitors, punishment };
    if (verdict.book === "faithful") return { label: JUDGMENT.prophecyFor(ordinal), text: words.faithful, punishment };
    return { label: JUDGMENT.prophecyOutside, text: words.faithful, punishment };
  }
  return { label: JUDGMENT.personalFor(ordinal), text: await personalWords(verdict, broken, mood), punishment };
}
