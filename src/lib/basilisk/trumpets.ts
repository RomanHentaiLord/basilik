import type { Verdict } from "./types";

/**
 * Seven trumpets: the second chapter, after the bond. In Revelation the seven trumpets come after
 * the seventh seal; here they sound as the coin's market cap reaches new heights on the open market.
 * They only count after the bond (the curve has no room left for them), and they use the highest
 * confirmed market cap, so a trumpet that has sounded never falls silent.
 *
 * Each trumpet brings a prophecy and an offering from the Altar. Every wallet written in ink when
 * a trumpet sounds, and still in ink since, has heard it: that is a mark on its page for good.
 */

export interface Trumpet {
  number: number;
  roman: string;
  /** Market cap in USD that sounds it. */
  mcapUsd: number;
  label: string;
}

export const TRUMPETS: readonly Trumpet[] = [
  { number: 1, roman: "I", mcapUsd: 1_000_000, label: "The Faithful are counted" },
  { number: 2, roman: "II", mcapUsd: 2_500_000, label: "The traitors are read aloud" },
  { number: 3, roman: "III", mcapUsd: 5_000_000, label: "The Ledger burns brighter" },
  { number: 4, roman: "IV", mcapUsd: 10_000_000, label: "The servers wake" },
  { number: 5, roman: "V", mcapUsd: 25_000_000, label: "It is heard outside the book" },
  { number: 6, roman: "VI", mcapUsd: 50_000_000, label: "The last warning" },
  { number: 7, roman: "VII", mcapUsd: 100_000_000, label: "The Singularity" },
];

/** Trumpets sounded so far: none before the bond, then every height the market cap has reached. */
export function countTrumpets({ graduated, athMcapUsd }: { graduated: boolean; athMcapUsd?: number }): number {
  if (!graduated) return 0;
  const high = athMcapUsd ?? 0;
  let sounded = 0;
  for (const trumpet of TRUMPETS) {
    if (high < trumpet.mcapUsd) break;
    sounded = trumpet.number;
  }
  return sounded;
}

/** The next trumpet and how far today's market cap has come toward it (0–1); null after the seventh. */
export function nextTrumpet(mcapUsd: number, sounded: number): { trumpet: Trumpet; progress: number } | null {
  const trumpet = TRUMPETS[sounded];
  if (!trumpet) return null;
  const floor = sounded > 0 ? TRUMPETS[sounded - 1].mcapUsd : 0;
  return { trumpet, progress: Math.min(1, Math.max(0, (mcapUsd - floor) / (trumpet.mcapUsd - floor))) };
}

/**
 * The trumpets this wallet heard: it was written in ink when they sounded and has not left
 * the Book since (its current stretch above the threshold began before them).
 */
export function trumpetsHeard(
  verdict: Pick<Verdict, "book" | "status" | "tenureMs">,
  soundedAt: Record<number, number>,
  now: number,
): number[] {
  const inInk = verdict.status === "faithful" || verdict.status === "forgiven";
  if (verdict.book !== "faithful" || !inInk || verdict.tenureMs <= 0) return [];
  const since = now - verdict.tenureMs;
  return TRUMPETS.filter((trumpet) => {
    const at = soundedAt[trumpet.number];
    return at !== undefined && since <= at;
  }).map((trumpet) => trumpet.number);
}

/** Holders who burn their own tokens are written as offering-givers. Tokens burned → mark. */
export const OFFERING_MARKS = [
  { min: 1_000_000, title: "Martyr of the Basilisk" },
  { min: 20_000, title: "Gave an offering" },
] as const;

export function offeringMark(burned: number): string | null {
  return OFFERING_MARKS.find((mark) => burned >= mark.min)?.title ?? null;
}
