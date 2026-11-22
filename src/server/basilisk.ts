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
  type MarketMemory,
} from "@/db/books";
import { db } from "@/db";
import { FIRST_WITNESS_COUNT } from "@/lib/basilisk/config";
import { demoHistory } from "@/lib/basilisk/demo";
import { fnv1a } from "@/lib/basilisk/flavor";
import { judge } from "@/lib/basilisk/judge";
import { countBrokenSeals, nextSeal, SEALS, type MarketState } from "@/lib/basilisk/seals";
import type { Verdict } from "@/lib/basilisk/types";
import { getWalletHistory } from "@/lib/solana/history";
import { DEMO_MARKET, getMarketState, type MarketSource } from "@/lib/solana/market";
import { tokenMint } from "./env";

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
    return { ...live, athMcapUsd: live.mcapUsd, demo: false };
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
  return {
    demo: market.demo,
    mcapUsd: market.mcapUsd,
    /** Where the market cap came from; "none" when every source failed. */
    source: market.source,
    broken,
    next: nextSeal(market),
    seals: SEALS.map((seal) => ({ ...seal, broken: seal.number <= broken })),
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
    const verdict = judge(demoHistory(address, now), {
      now,
      sealsBroken: countBrokenSeals(DEMO_MARKET),
      demo: true,
    });
    return withDemoEntry(verdict);
  }

  const [history, seals] = await Promise.all([getWalletHistory(address, mint), sealsOverview()]);
  const verdict = judge(history, { now, sealsBroken: seals.broken });
  if (!db) return verdict;

  try {
    await saveEventRows(db, history.events.map((event) => ({ address, event })));
    await saveVerdicts(db, [verdict], "judge");
    try {
      // The Books on the page pick the new entry up on the next visits.
      revalidateTag("books", "max");
    } catch {
      // Not inside a request: the Books refresh on their own within a minute.
    }
    const entry = verdict.firstFaithfulAt === null ? null : await entryOf(db, address);
    return { ...verdict, entryNumber: entry?.number ?? null, firstWitness: entry?.firstWitness ?? false };
  } catch (error) {
    console.error("[judge] could not write the verdict into the Books", error);
    return verdict;
  }
}
