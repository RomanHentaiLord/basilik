import "server-only";
import { revalidateTag } from "next/cache";
import { MARKET_ATH_KEY, mergeMarketMemory, readState, tryLock, unlock, writeState, type MarketMemory } from "@/db/books";
import { db } from "@/db";
import { countBrokenSeals } from "@/lib/basilisk/seals";
import type { ParsedTransaction } from "@/lib/solana/parse";
import { getMarketState } from "@/lib/solana/market";
import { getTransactions, rpc } from "@/lib/solana/rpc";
import { tokenMint } from "./env";
import { runIndexer, type ChainSource, type IndexerResult, type SignatureInfo } from "./indexer-core";

/** Runs started by visitors wait at least this long between each other. */
const MIN_INTERVAL_MS = 60_000;
/** A run that crashed frees the lock after this long. */
const LOCK_TTL_MS = 120_000;
/** Transactions read per run: about 4 batched RPC calls, well inside a serverless time limit. */
const BUDGET = 80;
const TX_BATCH = 20;

/** The mint's transactions, through any Solana RPC. */
function rpcSource(mint: string): ChainSource {
  return {
    signatures: ({ before, until, limit }) =>
      rpc<SignatureInfo[]>("getSignaturesForAddress", [mint, { limit, before, until, commitment: "confirmed" }]),
    transactions: (signatures) => getTransactions<ParsedTransaction>(signatures, TX_BATCH),
  };
}

export type IndexerOutcome =
  | ({
      ran: true;
      mcapUsd: number;
      /** Which source gave the market cap: chain, dexscreener, helius, geckoterminal, override or none. */
      marketSource: string;
      athMcapUsd: number;
      graduated: boolean;
      sealsBroken: number;
    } & IndexerResult)
  | { ran: false; reason: "demo" | "no-database" | "no-rpc" | "recent" | "busy" };

/**
 * One pass of the sales scanner. Called by the /api/indexer route (cron, GitHub Actions)
 * with `force`, and after visitors' requests without it (then at most once a minute).
 */
export async function runIndexerOnce({ force = false }: { force?: boolean } = {}): Promise<IndexerOutcome> {
  const mint = tokenMint();
  if (!mint) return { ran: false, reason: "demo" };
  if (!db) return { ran: false, reason: "no-database" };
  if (!process.env.SOLANA_RPC_URL) return { ran: false, reason: "no-rpc" };

  const now = Date.now();
  if (!force) {
    const last = await readState<{ at: number }>(db, "last-run");
    if (last && now - last.at < MIN_INTERVAL_MS) return { ran: false, reason: "recent" };
  }
  if (!(await tryLock(db, "lock", LOCK_TTL_MS))) return { ran: false, reason: "busy" };

  try {
    // Seals never close: keep the highest market cap ever seen, and graduation once it happened.
    const market = await getMarketState(mint);
    const memory = mergeMarketMemory(await readState<MarketMemory>(db, MARKET_ATH_KEY), market);
    if (memory.changed) await writeState(db, MARKET_ATH_KEY, { usd: memory.usd, graduated: memory.graduated });
    const sealsBroken = countBrokenSeals({
      mcapUsd: market.mcapUsd,
      graduated: Boolean(memory.graduated),
      athMcapUsd: memory.usd,
    });

    const exclude = [process.env.ALTAR_WALLET?.trim()].filter((address): address is string => Boolean(address));
    const result = await runIndexer({ db, mint, source: rpcSource(mint), now, sealsBroken, budget: BUDGET, exclude });
    await writeState(db, "last-run", { at: now, scanned: result.scanned, events: result.events });

    try {
      revalidateTag("books", "max");
    } catch {
      // Outside a request scope: the Books refresh on their own within a minute.
    }
    return {
      ran: true,
      mcapUsd: market.mcapUsd,
      marketSource: market.source,
      athMcapUsd: memory.usd,
      graduated: Boolean(memory.graduated),
      sealsBroken,
      ...result,
    };
  } finally {
    await unlock(db, "lock");
  }
}
