import {
  DAY_MS,
  DOUBT_WINDOW_DAYS,
  FAITHFUL_THRESHOLD,
  RANKS,
  RANK_FLOORS,
  TENURE_MAX_STEPS,
  TENURE_RANK_CAP,
  TENURE_STEP_DAYS,
  type Rank,
} from "./config";
import { rankByBalance } from "./judge";
import type { Verdict } from "./types";

/** How far a wallet is from the next rank: tokens to buy, or days to hold without a sale. */
export interface RankStep {
  rank: Rank;
  /** Tokens still missing to reach the rank by balance. */
  more: number;
  /** Days of holding without a sale until tenure lifts the wallet, or null when tenure cannot. */
  days: number | null;
}

export function nextRankStep(
  verdict: Pick<Verdict, "status" | "rank" | "balance" | "tenureDays">,
): RankStep | null {
  if (!verdict.rank) return null;
  const next = RANKS[RANKS.indexOf(verdict.rank) + 1];
  if (!next) return null;
  const more = Math.max(0, RANK_FLOORS[next] - verdict.balance);
  // Tenure lifts a faithful wallet up to the cap, a limited number of steps above its balance rank.
  const base = rankByBalance(verdict.balance) ?? verdict.rank;
  const stepsUsed = RANKS.indexOf(verdict.rank) - RANKS.indexOf(base);
  const tenureCanLift =
    verdict.status === "faithful" &&
    stepsUsed < TENURE_MAX_STEPS &&
    RANKS.indexOf(next) <= RANKS.indexOf(TENURE_RANK_CAP);
  const days = tenureCanLift ? TENURE_STEP_DAYS - (verdict.tenureDays % TENURE_STEP_DAYS) : null;
  return { rank: next, more, days };
}

/** Days until a doubter's pencil entry turns to ink (no sale for the whole doubt window). */
export function daysUntilInk(lastSellAt: number | null, now: number): number | null {
  if (lastSellAt === null) return null;
  const left = Math.ceil((lastSellAt + DOUBT_WINDOW_DAYS * DAY_MS - now) / DAY_MS);
  return Math.max(0, left);
}

/** Tokens a wallet still needs to enter the Book of the Faithful. */
export function tokensToEnter(balance: number): number {
  return Math.max(0, FAITHFUL_THRESHOLD - balance);
}
