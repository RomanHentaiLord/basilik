import "server-only";
import { cacheLife } from "next/cache";
import { entryOf, MARKET_ATH_KEY, readState, saveEventRows, saveVerdicts } from "@/db/books";
import { db } from "@/db";
import { FIRST_WITNESS_COUNT } from "@/lib/basilisk/config";
import { demoHistory } from "@/lib/basilisk/demo";
import { fnv1a } from "@/lib/basilisk/flavor";
import { judge } from "@/lib/basilisk/judge";
import { countBrokenSeals, nextSeal, SEALS, type MarketState } from "@/lib/basilisk/seals";
import type { Verdict } from "@/lib/basilisk/types";
import { getWalletHistory } from "@/lib/solana/history";
import { DEMO_MARKET, getMarketState } from "@/lib/solana/market";
import { tokenMint } from "./env";

export { tokenMint };

/** How many imaginary wallets have entered the Book in demo mode, for entry numbers. */
const DEMO_ENTERED = 1200;

export async function marketState(): Promise<MarketState & { demo: boolean }> {
  const mint = tokenMint();
  if (!mint) return { ...DEMO_MARKET, demo: true };
  const market = await getMarketState(mint);
  let ath = market.mcapUsd;
  if (db) {
    try {
      ath = Math.max(ath, (await readState<{ usd: number }>(db, MARKET_ATH_KEY))?.usd ?? 0);
    } catch (error) {
      console.error("[market] could not read the all-time high", error);
    }
  }
  return { ...market, athMcapUsd: ath, demo: false };
}

/** Seals, market cap and progress. Cached for a minute: the page stays static between refreshes. */
export async function sealsOverview() {
  "use cache";
  cacheLife("minutes");

  const market = await marketState();
  const broken = countBrokenSeals(market);
  return {
    demo: market.demo,
    mcapUsd: market.mcapUsd,
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
    const entry = verdict.firstFaithfulAt === null ? null : await entryOf(db, address);
    return { ...verdict, entryNumber: entry?.number ?? null, firstWitness: entry?.firstWitness ?? false };
  } catch (error) {
    console.error("[judge] could not write the verdict into the Books", error);
    return verdict;
  }
}
