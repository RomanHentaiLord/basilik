import "server-only";
import { revalidateTag } from "next/cache";
import { MARKET_ATH_KEY, mergeMarketMemory, readState, tryLock, unlock, writeState, type MarketMemory } from "@/db/books";
import { db } from "@/db";
import { countBrokenSeals } from "@/lib/basilisk/seals";
import { countTrumpets } from "@/lib/basilisk/trumpets";
import type { ParsedTransaction } from "@/lib/solana/parse";
import { getMarketState, PROVIDERS } from "@/lib/solana/market";
import { getTransactions, rpc } from "@/lib/solana/rpc";
import { tokenMint } from "./env";
import { speakAfterPass } from "./voice";
import { runIndexer, type ChainSource, type IndexerResult, type SignatureInfo } from "./indexer-core";

/** Runs started by visitors wait at least this long between each other. */
const MIN_INTERVAL_MS = 60_000;
/** A run that crashed frees the lock after this long. */
const LOCK_TTL_MS = 120_000;
/** Transactions read per run: about 10 batched RPC calls, well inside a serverless time limit. */
const BUDGET = 80;
/** 8 transactions a second at most, so visitors' requests still fit in a 10-per-second RPC plan. */
const TX_BATCH = 8;
const TX_GAP_MS = 1_000;
/** Nobody waits for the indexer: price sites get longer to answer than on a page. */
const MARKET_TIMEOUT_MS = 8_000;

/** The mint's transactions, through any Solana RPC. */
function rpcSource(mint: string): ChainSource {
  return {
    signatures: ({ before, until, limit }) =>
      rpc<SignatureInfo[]>("getSignaturesForAddress", [mint, { limit, before, until, commitment: "confirmed" }]),
    transactions: (signatures) => getTransactions<ParsedTransaction>(signatures, { size: TX_BATCH, gapMs: TX_GAP_MS }),
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
      /** Share of the bonding curve sold, in percent. */
      curvePercent: number;
      sealsBroken: number;
      /** The Basilisk's mood this pass, null when it could not speak. */
      mood: "calm" | "grim" | null;
      /** Seals that broke and spoke during this pass. */
      sealsSpoken: number[];
      /** Trumpets sounded so far (after the bond), and those that sounded during this pass. */
      trumpets: number;
      trumpetsSounded: number[];
      /** Today's psalm: written in this pass, kept from an earlier one, or none before the first seal. */
      psalm: "kept" | "written" | "none";
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
    // Seals never close: keep the highest confirmed market cap, and graduation once it happened.
    const market = await getMarketState(mint, PROVIDERS, MARKET_TIMEOUT_MS);
    const memory = mergeMarketMemory(await readState<MarketMemory>(db, MARKET_ATH_KEY), market, now);
    if (memory.changed) {
      const saved: MarketMemory = {
        usd: memory.usd,
        graduated: memory.graduated,
        curveHigh: memory.curveHigh,
        lastCurve: memory.lastCurve,
        lastUsd: memory.lastUsd,
        lastSource: memory.lastSource,
        lastAt: memory.lastAt,
      };
      await writeState(db, MARKET_ATH_KEY, saved);
    }
    const sealsBroken = countBrokenSeals({
      mcapUsd: market.mcapUsd,
      graduated: memory.graduated,
      curve: market.curve,
      curveHigh: memory.curveHigh,
    });

    // After the bond, the trumpets: heights of the confirmed market cap.
    const trumpets = countTrumpets({ graduated: memory.graduated, athMcapUsd: memory.usd });

    const exclude = [process.env.ALTAR_WALLET?.trim()].filter((address): address is string => Boolean(address));
    const result = await runIndexer({
      db,
      mint,
      source: rpcSource(mint),
      now,
      sealsBroken,
      stage: sealsBroken + trumpets,
      budget: BUDGET,
      exclude,
    });
    await writeState(db, "last-run", { at: now, scanned: result.scanned, events: result.events });

    // A seal that has just broken speaks once, and the psalm is written once a day.
    let voice: Awaited<ReturnType<typeof speakAfterPass>> | null = null;
    try {
      voice = await speakAfterPass(db, {
        now,
        broken: sealsBroken,
        trumpets,
        mcapUsd: market.mcapUsd,
        curve: market.curve ?? memory.lastCurve,
        curveHigh: memory.curveHigh,
      });
      if (voice.sealsSpoken.length > 0) console.log(`[indexer] seals spoke: ${voice.sealsSpoken.join(", ")}`);
      if (voice.trumpetsSounded.length > 0) console.log(`[indexer] trumpets sounded: ${voice.trumpetsSounded.join(", ")}`);
    } catch (error) {
      console.error("[indexer] the Basilisk could not speak", error);
    }

    try {
      revalidateTag("books", "max");
      revalidateTag("market", "max");
    } catch {
      // Outside a request scope: the Books refresh on their own within a minute.
    }
    return {
      ran: true,
      mcapUsd: market.mcapUsd,
      marketSource: market.source,
      athMcapUsd: memory.usd,
      graduated: memory.graduated,
      curvePercent: Math.round((market.curve ?? memory.lastCurve) * 1000) / 10,
      sealsBroken,
      mood: voice?.mood ?? null,
      sealsSpoken: voice?.sealsSpoken ?? [],
      trumpets,
      trumpetsSounded: voice?.trumpetsSounded ?? [],
      psalm: voice?.psalm ?? "none",
      ...result,
    };
  } finally {
    await unlock(db, "lock");
  }
}
