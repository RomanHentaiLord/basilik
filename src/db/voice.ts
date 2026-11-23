import { and, count, eq, gte } from "drizzle-orm";
import type { Mood } from "@/lib/basilisk/prophecy";
import type { Status } from "@/lib/basilisk/types";
import { readState, writeState, type AnyDb } from "./books";
import { prophecies, seals, wallets } from "./schema";

/**
 * What the Basilisk has said, kept in the database: the words of each broken seal,
 * the psalm of each day, and the personal prophecies the model wrote.
 * Pure functions over a Drizzle database, like books.ts, so tests run them on PGlite.
 */

export interface SealWords {
  faithful: string;
  traitors: string;
}

export interface SealRecord {
  number: number;
  brokenAt: number;
  mcapUsd: number;
  words: SealWords | null;
}

export async function sealRecords(db: AnyDb): Promise<SealRecord[]> {
  const rows = await db.select().from(seals).orderBy(seals.number);
  return rows.map((row) => ({
    number: row.number,
    brokenAt: row.brokenAt.getTime(),
    mcapUsd: row.mcapUsd,
    words:
      row.prophecyFaithful && row.prophecyTraitors
        ? { faithful: row.prophecyFaithful, traitors: row.prophecyTraitors }
        : null,
  }));
}

/**
 * Writes down every broken seal that has no record yet, with its prophecy. A seal is written
 * once: the first indexer pass that sees it broken. Returns the numbers it wrote.
 */
export async function recordBrokenSeals(
  db: AnyDb,
  {
    broken,
    mcapUsd,
    now,
    speak,
  }: { broken: number; mcapUsd: number; now: number; speak: (seal: number) => Promise<SealWords> },
): Promise<number[]> {
  if (broken <= 0) return [];
  const known = new Set((await db.select({ number: seals.number }).from(seals)).map((row) => row.number));
  const missing = Array.from({ length: broken }, (_, i) => i + 1).filter((seal) => !known.has(seal));
  if (missing.length === 0) return [];

  const words = await Promise.all(missing.map((seal) => speak(seal)));
  const rows = missing.map((number, i) => ({
    number,
    brokenAt: new Date(now),
    mcapUsd,
    prophecyFaithful: words[i].faithful,
    prophecyTraitors: words[i].traitors,
  }));
  const written = await db.insert(seals).values(rows).onConflictDoNothing().returning({ number: seals.number });
  return written.map((row) => row.number);
}

export interface Psalm {
  day: string;
  text: string;
  mood: Mood;
  source: "template" | "model";
}

const psalmKey = (day: string) => `psalm:${day}`;

export async function readPsalm(db: AnyDb, day: string): Promise<Psalm | null> {
  return readState<Psalm>(db, psalmKey(day));
}

export async function writePsalm(db: AnyDb, psalm: Psalm): Promise<void> {
  await writeState(db, psalmKey(psalm.day), psalm);
}

/** How many wallets went into ink and into red since a moment: sets the Basilisk's mood. */
export async function bookBalance(db: AnyDb, sinceMs: number): Promise<{ newFaithful: number; newTraitors: number }> {
  const since = new Date(sinceMs);
  const [[faithful], [traitors]] = await Promise.all([
    db.select({ n: count() }).from(wallets).where(gte(wallets.firstFaithfulAt, since)),
    db
      .select({ n: count() })
      .from(wallets)
      .where(and(eq(wallets.status, "traitor"), gte(wallets.traitorAt, since))),
  ]);
  return { newFaithful: Number(faithful?.n ?? 0), newTraitors: Number(traitors?.n ?? 0) };
}

/** The model's prophecy for a wallet at a seal, if it was written for the wallet's current status. */
export async function cachedProphecy(db: AnyDb, address: string, seal: number, status: Status): Promise<string | null> {
  const [row] = await db
    .select({ text: prophecies.text, status: prophecies.status })
    .from(prophecies)
    .where(and(eq(prophecies.address, address), eq(prophecies.seal, seal)));
  return row && row.status === status ? row.text : null;
}

export async function saveProphecy(
  db: AnyDb,
  { address, seal, status, text, now = new Date() }: { address: string; seal: number; status: Status; text: string; now?: Date },
): Promise<void> {
  await db
    .insert(prophecies)
    .values({ address, seal, status, text, createdAt: now })
    .onConflictDoUpdate({ target: [prophecies.address, prophecies.seal], set: { text, status, createdAt: now } });
}
