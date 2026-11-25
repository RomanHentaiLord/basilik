import "server-only";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import {
  entryOf,
  MARKET_ATH_KEY,
  mergeMarketMemory,
  readState,
  savedReading,
  saveEventRows,
  saveVerdicts,
  storedWallet,
  type MarketMemory,
} from "@/db/books";
import { db, type Db } from "@/db";
import { FIRST_WITNESS_COUNT } from "@/lib/basilisk/config";
import { demoHistory } from "@/lib/basilisk/demo";
import { fnv1a } from "@/lib/basilisk/flavor";
import { judge } from "@/lib/basilisk/judge";
import { trumpetProphecy } from "@/lib/basilisk/prophecy";
import { countBrokenSeals, nextSeal, SEALS, type MarketState } from "@/lib/basilisk/seals";
import { countTrumpets, nextTrumpet, TRUMPETS, trumpetsHeard } from "@/lib/basilisk/trumpets";
import type { Verdict, WalletEvent } from "@/lib/basilisk/types";
import { getWalletHistory } from "@/lib/solana/history";
import { offeredBy } from "@/db/voice";
import { DEMO_MARKET, getMarketState, type MarketSource } from "@/lib/solana/market";
import { tokenMint } from "./env";
import { readVoice, walletProphecy } from "./voice";

export { tokenMint };

/** How many imaginary wallets have entered the Book in demo mode, for entry numbers. */
const DEMO_ENTERED = 1200;

/** While the indexer's last reading is this fresh, a page uses it and asks nobody. */
const SAVED_FRESH_MS = 5 * 60_000;
/** When every source fails, the indexer's last reading is still shown if it is this fresh. */
const SAVED_FALLBACK_MS = 30 * 60_000;

export async function marketState(): Promise<MarketState & { demo: boolean; source: MarketSource }> {
  const mint = tokenMint();
  if (!mint) return { ...DEMO_MARKET, demo: true, source: "demo" };

  const unconfirmed = async () => {
    // Without the saved memory nothing can be confirmed: the reading stands on its own.
    const live = await getMarketState(mint);
    return { ...live, athMcapUsd: live.mcapUsd, curveHigh: live.curve, demo: false };
  };
  if (!db) return unconfirmed();

  let memory: MarketMemory | null;
  try {
    memory = await readState<MarketMemory>(db, MARKET_ATH_KEY);
  } catch (error) {
    console.error("[market] could not read the market memory", error);
    return unconfirmed();
  }

  // The indexer read the market a moment ago: no rate limits, no slow price sites for a page.
  const now = Date.now();
  const fresh = savedReading(memory, now, SAVED_FRESH_MS);
  if (fresh) {
    return {
      mcapUsd: fresh.mcapUsd,
      graduated: Boolean(memory?.graduated),
      curve: memory?.lastCurve,
      curveHigh: memory?.curveHigh,
      athMcapUsd: memory?.usd ?? 0,
      source: fresh.source as MarketSource,
      demo: false,
    };
  }

  const live = await getMarketState(mint);
  const merged = mergeMarketMemory(memory, live, now);
  const fallback = live.source === "none" ? savedReading(memory, now, SAVED_FALLBACK_MS) : null;
  return {
    mcapUsd: fallback?.mcapUsd ?? live.mcapUsd,
    graduated: merged.graduated,
    curve: live.curve ?? memory?.lastCurve,
    curveHigh: merged.curveHigh,
    athMcapUsd: merged.usd,
    source: (fallback?.source as MarketSource | undefined) ?? live.source,
    demo: false,
  };
}

/** Seals, market cap and progress. Cached for a minute: the page stays static between refreshes. */
export async function sealsOverview() {
  "use cache";
  cacheLife("minutes");
  cacheTag("market");

  const market = await marketState();
  const broken = countBrokenSeals(market);
  const voice = await readVoice(broken, market);
  const sounded = countTrumpets({ graduated: market.graduated, athMcapUsd: market.athMcapUsd });
  return {
    demo: market.demo,
    mcapUsd: market.mcapUsd,
    /** Where the market cap came from; "none" when every source failed. */
    source: market.source,
    /** Share of the bonding curve sold now (0–1), or null when the chain did not say. */
    curve: market.graduated ? 1 : (market.curve ?? null),
    graduated: market.graduated,
    broken,
    next: nextSeal(market),
    seals: SEALS.map((seal) => ({
      ...seal,
      broken: seal.number <= broken,
      /** What it said when this seal broke. */
      words: voice.words[seal.number] ?? null,
      brokenAt: voice.brokenAt[seal.number] ?? null,
    })),
    /** After the bond, the second chapter: seven trumpets on the market cap. */
    trumpets: {
      sounded,
      next: market.graduated ? nextTrumpet(market.mcapUsd, sounded) : null,
      list: TRUMPETS.map((trumpet) => ({
        ...trumpet,
        sounded: trumpet.number <= sounded,
        soundedAt: voice.trumpets[trumpet.number]?.soundedAt ?? null,
        words: trumpet.number <= sounded ? (voice.trumpets[trumpet.number]?.words ?? trumpetProphecy(trumpet.number)) : null,
      })),
    },
    /** Grim when the curve fell back or more wallets went red than into ink. */
    mood: voice.mood,
    /** Today's psalm, from the first seal. */
    psalm: voice.psalm,
  };
}

/** Demo entries get a stable imaginary place in the Book. */
function withDemoEntry(verdict: Verdict): Verdict {
  if (verdict.firstFaithfulAt === null) return verdict;
  const entryNumber = 1 + (fnv1a(`entry:${verdict.address}`) % DEMO_ENTERED);
  return { ...verdict, entryNumber, firstWitness: entryNumber <= FIRST_WITNESS_COUNT };
}

/**
 * Reads the wallet's whole history from the chain, judges it, writes the verdict and the
 * events into the Books, and returns the verdict with its place in the Book of the Faithful.
 */
export async function judgeWallet(address: string): Promise<Verdict> {
  const now = Date.now();
  const mint = tokenMint();

  if (!mint) {
    const seals = await sealsOverview();
    const verdict = withDemoEntry(judge(demoHistory(address, now), { now, sealsBroken: seals.broken, demo: true }));
    return { ...verdict, prophecy: await walletProphecy(verdict, wordsOf(seals)), ...(await marksOf(verdict, seals, now)) };
  }

  const [history, seals] = await Promise.all([getWalletHistory(address, mint), sealsOverview()]);
  const judged = judge(history, { now, sealsBroken: seals.broken });
  const verdict = db ? await writeIntoBooks(db, judged, history.events) : judged;
  return { ...verdict, prophecy: await walletProphecy(verdict, wordsOf(seals)), ...(await marksOf(verdict, seals, now)) };
}

/** The marks on a wallet's page: the trumpets it heard in ink, and the tokens it burned itself. */
async function marksOf(
  verdict: Verdict,
  seals: Awaited<ReturnType<typeof sealsOverview>>,
  now: number,
): Promise<Pick<Verdict, "trumpetsHeard" | "offered">> {
  const soundedAt: Record<number, number> = {};
  for (const trumpet of seals.trumpets.list) if (trumpet.soundedAt !== null) soundedAt[trumpet.number] = trumpet.soundedAt;
  const heard = trumpetsHeard(verdict, soundedAt, now);
  if (verdict.demo || !db) return { trumpetsHeard: heard, offered: 0 };
  try {
    return { trumpetsHeard: heard, offered: await offeredBy(db, verdict.address) };
  } catch (error) {
    console.error("[judge] could not read the wallet's offerings", error);
    return { trumpetsHeard: heard, offered: 0 };
  }
}

/** A stored judgment this fresh is shown on the verdict's page without asking the chain. */
const REMEMBERED_MS = 24 * 60 * 60_000;

/**
 * A wallet's verdict from what the Books already hold, without asking the chain: for the
 * verdict's own page and its card image, which crawlers fetch. Only wallets a visitor judged
 * in the last day qualify (their whole history is stored, the indexer adds what came after);
 * null for the rest, which are judged from the chain again.
 */
export async function rememberedVerdict(address: string): Promise<Verdict | null> {
  if (!tokenMint() || !db) return null;
  const now = Date.now();
  const stored = await storedWallet(db, address);
  if (!stored || stored.judgedAt === null || now - stored.judgedAt > REMEMBERED_MS) return null;
  const seals = await sealsOverview();
  const verdict = judge({ address, balance: stored.balance, events: stored.events }, { now, sealsBroken: seals.broken });
  const entry = verdict.firstFaithfulAt === null ? null : await entryOf(db, address);
  const placed = { ...verdict, entryNumber: entry?.number ?? null, firstWitness: entry?.firstWitness ?? false };
  return { ...placed, prophecy: await walletProphecy(placed, wordsOf(seals)), ...(await marksOf(placed, seals, now)) };
}

/** The seal words in the shape walletProphecy() reads. */
function wordsOf(seals: Awaited<ReturnType<typeof sealsOverview>>) {
  const words: Record<number, { faithful: string; traitors: string }> = {};
  for (const seal of seals.seals) if (seal.words) words[seal.number] = seal.words;
  return { broken: seals.broken, mood: seals.mood, words };
}

/** Writes the verdict and its events into the Books; returns it with its place in the Book. */
async function writeIntoBooks(database: Db, verdict: Verdict, events: WalletEvent[]): Promise<Verdict> {
  const address = verdict.address;
  try {
    await saveEventRows(database, events.map((event) => ({ address, event })));
    await saveVerdicts(database, [verdict], "judge");
    try {
      // The Books on the page pick the new entry up on the next visits.
      revalidateTag("books", "max");
    } catch {
      // Not inside a request: the Books refresh on their own within a minute.
    }
    const entry = verdict.firstFaithfulAt === null ? null : await entryOf(database, address);
    return { ...verdict, entryNumber: entry?.number ?? null, firstWitness: entry?.firstWitness ?? false };
  } catch (error) {
    console.error("[judge] could not write the verdict into the Books", error);
    return verdict;
  }
}
