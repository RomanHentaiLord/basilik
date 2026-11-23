import { PublicKey } from "@solana/web3.js";
import {
  loadEvents,
  readState,
  saveBurns,
  saveEventRows,
  saveVerdicts,
  stalestWallets,
  statusesOf,
  writeState,
  type AnyDb,
} from "@/db/books";
import { judge } from "@/lib/basilisk/judge";
import type { Verdict, WalletEvent } from "@/lib/basilisk/types";
import { parseBurns, parseTransaction, type ParsedTransaction, type TokenBalance } from "@/lib/solana/parse";

/**
 * The sales scanner. It walks the coin's transactions (everything that touches the mint),
 * classifies each balance change per wallet, stores the events and re-judges the wallets
 * that moved. Network and database come in as arguments, so tests run it on fixtures.
 *
 * Two cursors keep the walk cheap:
 * - `head`: the newest transaction processed. New activity is everything above it.
 * - `tail`: the oldest transaction processed. History below it is filled in ("backfill")
 *   with whatever budget a run has left, until the coin's first transaction.
 */

export interface SignatureInfo {
  signature: string;
  err: unknown;
}

export interface ChainSource {
  /** getSignaturesForAddress on the mint, newest first. */
  signatures(options: { before?: string; until?: string; limit: number }): Promise<SignatureInfo[]>;
  /** getTransaction (jsonParsed) for each signature, in the same order. */
  transactions(signatures: string[]): Promise<(ParsedTransaction | null)[]>;
}

export interface Cursor {
  head: string | null;
  tail: string | null;
  backfillDone: boolean;
}

export const CURSOR_KEY = "cursor";

export interface IndexerRun {
  db: AnyDb;
  mint: string;
  source: ChainSource;
  now: number;
  sealsBroken: number;
  /** Most transactions to read in one run. */
  budget?: number;
  /** Wallets kept out of both Books (the creator-fee wallet). */
  exclude?: string[];
  /** Wallets re-judged per run because time alone changes them (tenure marks, repentance). */
  refresh?: number;
}

export interface IndexerResult {
  scanned: number;
  transactions: number;
  events: number;
  wallets: number;
  /** Burns of the coin found in this run. */
  burns: number;
  /** Wallets re-judged only because time passed. */
  refreshed: number;
  newTraitors: string[];
  cursor: Cursor;
}

const PAGE = 1000;
/** New activity is read at most this many pages deep in one run; the rest waits for the next. */
const MAX_FRESH_PAGES = 5;

/** Every signature newer than `head`, newest first. */
async function freshSince(source: ChainSource, head: string): Promise<SignatureInfo[]> {
  const out: SignatureInfo[] = [];
  let before: string | undefined;
  for (let page = 0; page < MAX_FRESH_PAGES; page++) {
    const list = await source.signatures({ until: head, before, limit: PAGE });
    out.push(...list);
    if (list.length < PAGE) break;
    before = list[list.length - 1].signature;
  }
  return out;
}

/** Owners whose balance of the mint changed in this transaction. */
function ownersOf(tx: ParsedTransaction, mint: string): string[] {
  const owners = new Set<string>();
  const all: TokenBalance[] = [...(tx.meta?.preTokenBalances ?? []), ...(tx.meta?.postTokenBalances ?? [])];
  for (const balance of all) if (balance.mint === mint && balance.owner) owners.add(balance.owner);
  return [...owners];
}

/** The owner's balance of the mint after the transaction, in UI units. */
function balanceAfter(tx: ParsedTransaction, owner: string, mint: string): number {
  let raw = BigInt(0);
  let decimals = 6;
  for (const balance of tx.meta?.postTokenBalances ?? []) {
    if (balance.mint === mint && balance.owner === owner) {
      raw += BigInt(balance.uiTokenAmount.amount);
      decimals = balance.uiTokenAmount.decimals;
    }
  }
  return Number(raw) / 10 ** decimals;
}

/**
 * People sign with keys on the ed25519 curve; program accounts (the bonding curve, AMM pools,
 * vault authorities) are PDAs off the curve. Those hold tokens too, but they are not wallets.
 */
export function isPersonalWallet(address: string): boolean {
  try {
    return PublicKey.isOnCurve(new PublicKey(address).toBytes());
  } catch {
    return false;
  }
}

export async function runIndexer(run: IndexerRun): Promise<IndexerResult> {
  const budget = run.budget ?? 80;
  const cursor = (await readState<Cursor>(run.db, CURSOR_KEY)) ?? { head: null, tail: null, backfillDone: false };
  const next: Cursor = { ...cursor };
  let batch: SignatureInfo[] = [];

  if (!cursor.head) {
    // First run: the newest transactions; the past is filled in by later runs.
    batch = await run.source.signatures({ limit: budget });
    if (batch.length > 0) {
      next.head = batch[0].signature;
      next.tail = batch[batch.length - 1].signature;
    }
    next.backfillDone = batch.length < budget;
  } else {
    const fresh = await freshSince(run.source, cursor.head);
    if (fresh.length > budget) {
      // Too much new activity for one run: take the part right above the head, keep the walk contiguous.
      batch = fresh.slice(-budget);
      next.head = batch[0].signature;
    } else {
      batch = fresh;
      if (fresh.length > 0) next.head = fresh[0].signature;
      const room = budget - fresh.length;
      if (!cursor.backfillDone && room > 0 && cursor.tail) {
        const older = await run.source.signatures({ before: cursor.tail, limit: room });
        batch = [...batch, ...older];
        if (older.length > 0) next.tail = older[older.length - 1].signature;
        if (older.length < room) next.backfillDone = true;
      }
    }
  }

  const ok = batch.filter((info) => !info.err).map((info) => info.signature);
  const transactions = ok.length > 0 ? await run.source.transactions(ok) : [];
  const exclude = new Set(run.exclude ?? []);

  const rows: { address: string; event: WalletEvent }[] = [];
  for (const tx of transactions) {
    if (!tx?.meta || tx.meta.err) continue;
    for (const owner of ownersOf(tx, run.mint)) {
      if (exclude.has(owner) || !isPersonalWallet(owner)) continue;
      const parsed = parseTransaction(tx, owner, run.mint);
      if (!parsed) continue;
      rows.push({ address: owner, event: { ...parsed, balanceAfter: balanceAfter(tx, owner, run.mint) } });
    }
  }

  const inserted = rows.length > 0 ? await saveEventRows(run.db, rows) : 0;

  // Burns are counted for everyone, the Altar included: they are offerings, not trades.
  const burnRows = transactions.flatMap((tx) => (tx ? parseBurns(tx, run.mint) : []));
  const burned =
    burnRows.length > 0 ? await saveBurns(run.db, burnRows.map((burn) => ({ ...burn, seal: run.sealsBroken }))) : 0;

  const touched = [...new Set(rows.map((row) => row.address))];
  let newTraitors: string[] = [];

  if (touched.length > 0) {
    const before = await statusesOf(run.db, touched);
    const histories = await loadEvents(run.db, touched);
    const verdicts: Verdict[] = touched.map((address) => {
      const list = histories.get(address) ?? [];
      const balance = list.length > 0 ? list[list.length - 1].balanceAfter : 0;
      return judge({ address, balance, events: list }, { now: run.now, sealsBroken: run.sealsBroken });
    });
    await saveVerdicts(run.db, verdicts, "indexer", new Date(run.now));
    newTraitors = verdicts
      .filter((verdict) => verdict.status === "traitor" && before.get(verdict.address) !== "traitor")
      .map((verdict) => verdict.address);
  }

  // Ranks move with time now (1 hour, 2 hours…), so the oldest verdicts are re-read each run.
  const refreshLimit = run.refresh ?? 40;
  const stale = (await stalestWallets(run.db, refreshLimit + touched.length))
    .filter((address) => !touched.includes(address) && !exclude.has(address))
    .slice(0, refreshLimit);
  if (stale.length > 0) {
    const histories = await loadEvents(run.db, stale);
    const verdicts = stale.map((address) => {
      const list = histories.get(address) ?? [];
      const balance = list.length > 0 ? list[list.length - 1].balanceAfter : 0;
      return judge({ address, balance, events: list }, { now: run.now, sealsBroken: run.sealsBroken });
    });
    await saveVerdicts(run.db, verdicts, "indexer", new Date(run.now));
  }

  await writeState(run.db, CURSOR_KEY, next, new Date(run.now));

  return {
    scanned: batch.length,
    transactions: transactions.filter(Boolean).length,
    events: inserted,
    wallets: touched.length,
    burns: burned,
    refreshed: stale.length,
    newTraitors,
    cursor: next,
  };
}
