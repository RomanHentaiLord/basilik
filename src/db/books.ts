import { and, asc, count, desc, eq, inArray, isNotNull, lt, or, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { FIRST_WITNESS_COUNT } from "@/lib/basilisk/config";
import type { Verdict, WalletEvent } from "@/lib/basilisk/types";
import type * as schema from "./schema";
import { events, indexerState, wallets } from "./schema";

/**
 * Everything the site reads from and writes to the two Books.
 * Pure functions over a Drizzle database, so they run the same on Neon (production)
 * and on PGlite (tests). No "server-only" import here for that reason.
 */

export type AnyDb = PgDatabase<PgQueryResultHKT, typeof schema>;

/** indexer_state key holding what the market has reached so far (seals never close). */
export const MARKET_ATH_KEY = "market-ath";

/** What the market has reached so far (seals never close), and the last good reading. */
export interface MarketMemory {
  /** Highest confirmed market cap. */
  usd: number;
  graduated?: boolean;
  /** The last reading that had a price. A new high only counts once the next one reaches it too. */
  lastUsd?: number;
  /** Where that reading came from (chain, dexscreener…) and when (ms). */
  lastSource?: string;
  lastAt?: number;
}

/**
 * The stored memory plus a new reading. A high counts once two good readings in a row reach
 * it, so one bad answer from a price source can never break a seal. A reading without a price
 * changes nothing but graduation, which comes from the bonding curve and counts at once.
 * `changed` says whether the memory needs saving.
 */
export function mergeMarketMemory(
  memory: MarketMemory | null,
  reading: { mcapUsd: number; graduated: boolean; source?: string },
  now = Date.now(),
): Required<MarketMemory> & { changed: boolean } {
  // Memory saved before readings were confirmed has no lastUsd and may hold one bad reading
  // (the first DexScreener code read junk pairs): start over from the current reading.
  const known = memory?.lastUsd === undefined ? null : memory;
  const priced = reading.mcapUsd > 0 && reading.source !== "none";
  const confirmed = priced ? Math.min(known?.lastUsd ?? 0, reading.mcapUsd) : 0;
  const usd = Math.max(known?.usd ?? 0, confirmed);
  const graduated = Boolean(known?.graduated) || reading.graduated;
  const lastUsd = priced ? reading.mcapUsd : (known?.lastUsd ?? 0);
  const lastSource = priced ? (reading.source ?? "unknown") : (known?.lastSource ?? "none");
  const lastAt = priced ? now : (known?.lastAt ?? 0);
  const changed =
    !known ||
    usd !== known.usd ||
    graduated !== Boolean(known.graduated) ||
    lastUsd !== known.lastUsd ||
    lastAt !== (known.lastAt ?? 0);
  return { usd, graduated, lastUsd, lastSource, lastAt, changed };
}

/** The last good reading, if it is at most `maxAgeMs` old. */
export function savedReading(
  memory: MarketMemory | null,
  now: number,
  maxAgeMs: number,
): { mcapUsd: number; source: string; at: number } | null {
  if (!memory?.lastUsd || !memory.lastAt || !memory.lastSource || memory.lastSource === "none") return null;
  if (now - memory.lastAt > maxAgeMs) return null;
  return { mcapUsd: memory.lastUsd, source: memory.lastSource, at: memory.lastAt };
}

export interface TraitorRow {
  address: string;
  amount: number | null;
  punishment: string;
  at: number | null;
}

export interface FaithfulRow {
  address: string;
  title: string;
  /** Forgiven wallets keep a scar in the Book. */
  scar: boolean;
}

export interface FirstWitnesses {
  /** Places taken out of FIRST_WITNESS_COUNT. */
  taken: number;
  /** The very first names, gilded on the page. */
  names: { address: string; title: string }[];
}

export interface BooksOverview {
  demo: boolean;
  faithful: number;
  traitors: number;
  forgiven: number;
  latestFaithful: FaithfulRow[];
  latestTraitors: TraitorRow[];
  firstWitnesses: FirstWitnesses;
}

export interface FeedItem {
  address: string;
  title: string;
  amount: number | null;
  at: number;
}

const IN_THE_BOOK = ["faithful", "doubter", "forgiven"];
const IN_INK = ["faithful", "forgiven"];

function chunks<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

const toDate = (ms: number | null) => (ms === null ? null : new Date(ms));
const toMs = (date: Date | null) => (date === null ? null : date.getTime());

/** Stores classified balance changes. Already known (signature, wallet) pairs are skipped. */
export async function saveEventRows(db: AnyDb, rows: { address: string; event: WalletEvent }[]): Promise<number> {
  let inserted = 0;
  for (const chunk of chunks(rows, 400)) {
    const result = await db
      .insert(events)
      .values(
        chunk.map(({ address, event }) => ({
          signature: event.signature,
          address,
          kind: event.kind,
          amount: event.amount,
          balanceAfter: event.balanceAfter,
          at: new Date(event.at),
        })),
      )
      .onConflictDoNothing({ target: [events.signature, events.address] })
      .returning({ id: events.id });
    inserted += result.length;
  }
  return inserted;
}

/** Every stored event of these wallets, oldest first. */
export async function loadEvents(db: AnyDb, addresses: string[]): Promise<Map<string, WalletEvent[]>> {
  const out = new Map<string, WalletEvent[]>();
  for (const chunk of chunks(addresses, 300)) {
    const rows = await db
      .select()
      .from(events)
      .where(inArray(events.address, chunk))
      .orderBy(asc(events.at), asc(events.id));
    for (const row of rows) {
      const list = out.get(row.address) ?? [];
      list.push({
        signature: row.signature,
        at: row.at.getTime(),
        kind: row.kind as WalletEvent["kind"],
        amount: row.amount,
        balanceAfter: row.balanceAfter,
      });
      out.set(row.address, list);
    }
  }
  return out;
}

/** Current status of each wallet we already know. */
export async function statusesOf(db: AnyDb, addresses: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const chunk of chunks(addresses, 300)) {
    const rows = await db
      .select({ address: wallets.address, status: wallets.status })
      .from(wallets)
      .where(inArray(wallets.address, chunk));
    for (const row of rows) out.set(row.address, row.status);
  }
  return out;
}

/** Writes verdicts into the Books. The earliest known entry time always wins. */
export async function saveVerdicts(
  db: AnyDb,
  verdicts: Verdict[],
  source: "judge" | "indexer",
  now = new Date(),
): Promise<void> {
  const unique = [...new Map(verdicts.map((verdict) => [verdict.address, verdict])).values()];
  for (const chunk of chunks(unique, 200)) {
    if (chunk.length === 0) continue;
    await db
      .insert(wallets)
      .values(
        chunk.map((verdict) => ({
          address: verdict.address,
          status: verdict.status,
          rank: verdict.rank,
          title: verdict.title,
          flavor: verdict.flavor,
          balance: verdict.balance,
          peak: verdict.peak,
          firstFaithfulAt: toDate(verdict.firstFaithfulAt),
          lastSellAt: toDate(verdict.lastSellAt),
          traitorAt: toDate(verdict.traitorAt),
          betrayalSignature: verdict.betrayalSignature,
          betrayalAmount: verdict.betrayalAmount,
          scar: verdict.scar,
          source,
          lastJudgedAt: source === "judge" ? now : null,
          updatedAt: now,
        })),
      )
      .onConflictDoUpdate({
        target: wallets.address,
        set: {
          status: sql`excluded.status`,
          rank: sql`excluded.rank`,
          title: sql`excluded.title`,
          flavor: sql`excluded.flavor`,
          balance: sql`excluded.balance`,
          peak: sql`excluded.peak`,
          firstFaithfulAt: sql`least(${wallets.firstFaithfulAt}, excluded.first_faithful_at)`,
          lastSellAt: sql`excluded.last_sell_at`,
          traitorAt: sql`excluded.traitor_at`,
          betrayalSignature: sql`excluded.betrayal_signature`,
          betrayalAmount: sql`excluded.betrayal_amount`,
          scar: sql`excluded.scar`,
          source: sql`excluded.source`,
          lastJudgedAt: sql`coalesce(excluded.last_judged_at, ${wallets.lastJudgedAt})`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }
}

/** A wallet's place in the Book of the Faithful, counted by the time each wallet first entered. */
export async function entryOf(
  db: AnyDb,
  address: string,
): Promise<{ number: number; firstWitness: boolean } | null> {
  const [row] = await db
    .select({ at: wallets.firstFaithfulAt })
    .from(wallets)
    .where(eq(wallets.address, address));
  if (!row?.at) return null;
  const [ahead] = await db
    .select({ n: count() })
    .from(wallets)
    .where(
      or(
        lt(wallets.firstFaithfulAt, row.at),
        and(eq(wallets.firstFaithfulAt, row.at), lt(wallets.address, address)),
      ),
    );
  const number = Number(ahead?.n ?? 0) + 1;
  return { number, firstWitness: number <= FIRST_WITNESS_COUNT };
}

/** Counters, the newest names in both Books and the First Witnesses. */
export async function booksFromDb(db: AnyDb): Promise<BooksOverview> {
  const [counts] = await db
    .select({
      faithful: sql<number>`count(*) filter (where ${inArray(wallets.status, IN_THE_BOOK)})`.mapWith(Number),
      traitors: sql<number>`count(*) filter (where ${wallets.status} = 'traitor')`.mapWith(Number),
      forgiven: sql<number>`count(*) filter (where ${wallets.status} = 'forgiven')`.mapWith(Number),
      entered: sql<number>`count(${wallets.firstFaithfulAt})`.mapWith(Number),
    })
    .from(wallets);

  const traitors = await db
    .select({
      address: wallets.address,
      title: wallets.title,
      amount: wallets.betrayalAmount,
      at: wallets.traitorAt,
    })
    .from(wallets)
    .where(and(eq(wallets.status, "traitor"), isNotNull(wallets.traitorAt)))
    .orderBy(desc(wallets.traitorAt))
    .limit(5);

  const faithful = await db
    .select({ address: wallets.address, title: wallets.title, scar: wallets.scar })
    .from(wallets)
    .where(and(inArray(wallets.status, IN_INK), isNotNull(wallets.firstFaithfulAt)))
    .orderBy(desc(wallets.firstFaithfulAt))
    .limit(5);

  const first = await db
    .select({ address: wallets.address, title: wallets.title })
    .from(wallets)
    .where(isNotNull(wallets.firstFaithfulAt))
    .orderBy(asc(wallets.firstFaithfulAt), asc(wallets.address))
    .limit(3);

  return {
    demo: false,
    faithful: counts?.faithful ?? 0,
    traitors: counts?.traitors ?? 0,
    forgiven: counts?.forgiven ?? 0,
    latestFaithful: faithful,
    latestTraitors: traitors.map((row) => ({
      address: row.address,
      amount: row.amount,
      punishment: row.title,
      at: toMs(row.at),
    })),
    firstWitnesses: { taken: Math.min(FIRST_WITNESS_COUNT, counts?.entered ?? 0), names: first },
  };
}

/** The newest traitors, for the "New traitor" notes. */
export async function recentTraitors(db: AnyDb, limit = 8): Promise<FeedItem[]> {
  const rows = await db
    .select({
      address: wallets.address,
      title: wallets.title,
      amount: wallets.betrayalAmount,
      at: wallets.traitorAt,
    })
    .from(wallets)
    .where(and(eq(wallets.status, "traitor"), isNotNull(wallets.traitorAt)))
    .orderBy(desc(wallets.traitorAt))
    .limit(limit);
  return rows.map((row) => ({ address: row.address, title: row.title, amount: row.amount, at: row.at?.getTime() ?? 0 }));
}

export async function readState<T>(db: AnyDb, key: string): Promise<T | null> {
  const [row] = await db.select({ value: indexerState.value }).from(indexerState).where(eq(indexerState.key, key));
  return (row?.value as T | undefined) ?? null;
}

export async function writeState(db: AnyDb, key: string, value: unknown, now = new Date()): Promise<void> {
  await db
    .insert(indexerState)
    .values({ key, value, updatedAt: now })
    .onConflictDoUpdate({ target: indexerState.key, set: { value, updatedAt: now } });
}

/**
 * Takes a lock that expires by itself after `ttlMs` (a crashed run cannot hold it forever).
 * One statement, so two runs can never both get it.
 */
export async function tryLock(db: AnyDb, key: string, ttlMs: number, now = new Date()): Promise<boolean> {
  const rows = await db
    .insert(indexerState)
    .values({ key, value: { lockedAt: now.toISOString() }, updatedAt: now })
    .onConflictDoUpdate({
      target: indexerState.key,
      set: { value: { lockedAt: now.toISOString() }, updatedAt: now },
      setWhere: lt(indexerState.updatedAt, new Date(now.getTime() - ttlMs)),
    })
    .returning({ key: indexerState.key });
  return rows.length > 0;
}

export async function unlock(db: AnyDb, key: string): Promise<void> {
  await db.update(indexerState).set({ updatedAt: new Date(0) }).where(eq(indexerState.key, key));
}
