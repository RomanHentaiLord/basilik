import "server-only";
import { revalidateTag } from "next/cache";
import { MARKET_ATH_KEY, readState, tryLock, unlock, writeState } from "@/db/books";
import { db } from "@/db";
import { countBrokenSeals } from "@/lib/basilisk/seals";
import type { ParsedTransaction } from "@/lib/solana/parse";
import { getMarketState } from "@/lib/solana/market";
import { rpc, rpcBatch } from "@/lib/solana/rpc";
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
    async transactions(signatures) {
      const out: (ParsedTransaction | null)[] = [];
      for (let i = 0; i < signatures.length; i += TX_BATCH) {
        const chunk = signatures.slice(i, i + TX_BATCH);
        const results = await rpcBatch<ParsedTransaction | null>(
          chunk.map((signature) => ({
            method: "getTransaction",
            params: [signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }],
          })),
        );
        out.push(...results);
      }
      return out;
    },
  };
}

export type IndexerOutcome =
  | ({ ran: true; mcapUsd: number; athMcapUsd: number; sealsBroken: number } & IndexerResult)
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
    // Seals never close: keep the highest market cap ever seen.
    const market = await getMarketState(mint);
    const previous = (await readState<{ usd: number }>(db, MARKET_ATH_KEY))?.usd ?? 0;
    const ath = Math.max(previous, market.mcapUsd);
    if (ath > previous) await writeState(db, MARKET_ATH_KEY, { usd: ath });
    const sealsBroken = countBrokenSeals({ ...market, athMcapUsd: ath });

    const exclude = [process.env.ALTAR_WALLET?.trim()].filter((address): address is string => Boolean(address));
    const result = await runIndexer({ db, mint, source: rpcSource(mint), now, sealsBroken, budget: BUDGET, exclude });
    await writeState(db, "last-run", { at: now, scanned: result.scanned, events: result.events });

    try {
      revalidateTag("books", "max");
    } catch {
      // Outside a request scope: the Books refresh on their own within a minute.
    }
    return { ran: true, mcapUsd: market.mcapUsd, athMcapUsd: ath, sealsBroken, ...result };
  } finally {
    await unlock(db, "lock");
  }
}
