import {
  DOUBT_WINDOW_MS,
  FAITHFUL_THRESHOLD,
  RANKS,
  RANK_FLOORS,
  TENURE_MAX_STEPS,
  TENURE_RANK_CAP,
  TENURE_STEPS_MS,
  type Rank,
} from "./config";
import { rankByBalance } from "./judge";
import type { Verdict } from "./types";

/** How far a wallet is from the next rank: tokens to buy, or time to hold without a sale. */
export interface RankStep {
  rank: Rank;
  /** Tokens still missing to reach the rank by balance. */
  more: number;
  /** Time (ms) of holding without a sale until tenure lifts the wallet, or null when tenure cannot. */
  wait: number | null;
}

export function nextRankStep(
  verdict: Pick<Verdict, "status" | "rank" | "balance" | "tenureMs">,
): RankStep | null {
  if (!verdict.rank) return null;
  const next = RANKS[RANKS.indexOf(verdict.rank) + 1];
  if (!next) return null;
  const more = Math.max(0, RANK_FLOORS[next] - verdict.balance);
  // Tenure lifts a faithful wallet up to the cap, one rank per mark it passes.
  const base = rankByBalance(verdict.balance) ?? verdict.rank;
  const stepsUsed = RANKS.indexOf(verdict.rank) - RANKS.indexOf(base);
  const nextMark = TENURE_STEPS_MS.find((mark) => mark > verdict.tenureMs);
  const tenureCanLift =
    verdict.status === "faithful" &&
    nextMark !== undefined &&
    stepsUsed < TENURE_MAX_STEPS &&
    RANKS.indexOf(next) <= RANKS.indexOf(TENURE_RANK_CAP);
  return { rank: next, more, wait: tenureCanLift ? nextMark - verdict.tenureMs : null };
}

/** Time (ms) until a doubter's pencil entry turns to ink (no sale for the whole doubt window). */
export function untilInk(lastSellAt: number | null, now: number): number | null {
  if (lastSellAt === null) return null;
  return Math.max(0, lastSellAt + DOUBT_WINDOW_MS - now);
}

/** Tokens a wallet still needs to enter the Book of the Faithful. */
export function tokensToEnter(balance: number): number {
  return Math.max(0, FAITHFUL_THRESHOLD - balance);
}
