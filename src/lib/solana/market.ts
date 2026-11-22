import type { MarketState } from "@/lib/basilisk/seals";

/**
 * Market cap and graduation status for the seals.
 *
 * Source: DexScreener public API. While the coin is on the pump.fun bonding curve
 * its pair is listed under dexId "pumpfun"; any other dex means it has graduated.
 * TODO after launch: check the real response for our mint and adjust the graduation check.
 *
 * For local testing, MARKET_MCAP_USD / MARKET_GRADUATED override everything.
 */

interface DexPair {
  dexId?: string;
  marketCap?: number;
  fdv?: number;
}

export async function getMarketState(mint: string): Promise<MarketState> {
  const override = process.env.MARKET_MCAP_USD;
  if (override) {
    return {
      mcapUsd: Number(override),
      graduated: process.env.MARKET_GRADUATED === "true",
    };
  }

  try {
    // Called inside a "use cache" scope (sealsOverview), which decides how long this lives.
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
    if (!response.ok) throw new Error(`DexScreener HTTP ${response.status}`);
    const data = (await response.json()) as { pairs?: DexPair[] | null };
    const pairs = data.pairs ?? [];
    const mcapUsd = Math.max(0, ...pairs.map((pair) => pair.marketCap ?? pair.fdv ?? 0));
    const graduated = pairs.some((pair) => pair.dexId && pair.dexId !== "pumpfun");
    return { mcapUsd, graduated };
  } catch (error) {
    console.error("[market] falling back to zero market state", error);
    return { mcapUsd: 0, graduated: false };
  }
}

/** Market used in demo mode: three seals broken, halfway to the fourth. */
export const DEMO_MARKET: MarketState = { mcapUsd: 312_000, graduated: true };
