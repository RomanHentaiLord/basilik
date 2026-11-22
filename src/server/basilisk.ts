import "server-only";
import { cacheLife } from "next/cache";
import { demoHistory } from "@/lib/basilisk/demo";
import { judge } from "@/lib/basilisk/judge";
import { countBrokenSeals, nextSeal, SEALS, type MarketState } from "@/lib/basilisk/seals";
import type { Verdict } from "@/lib/basilisk/types";
import { getWalletHistory } from "@/lib/solana/history";
import { DEMO_MARKET, getMarketState } from "@/lib/solana/market";

/** The coin's mint address. Empty until launch → the whole site runs in demo mode. */
export function tokenMint(): string | null {
  return process.env.TOKEN_MINT?.trim() || null;
}

export async function marketState(): Promise<MarketState & { demo: boolean }> {
  const mint = tokenMint();
  if (!mint) return { ...DEMO_MARKET, demo: true };
  return { ...(await getMarketState(mint)), demo: false };
}

export async function judgeWallet(address: string): Promise<Verdict> {
  const now = Date.now();
  const mint = tokenMint();

  if (!mint) {
    return judge(demoHistory(address, now), {
      now,
      sealsBroken: countBrokenSeals(DEMO_MARKET),
      demo: true,
    });
  }

  const [history, market] = await Promise.all([
    getWalletHistory(address, mint),
    getMarketState(mint),
  ]);
  return judge(history, { now, sealsBroken: countBrokenSeals(market) });
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
