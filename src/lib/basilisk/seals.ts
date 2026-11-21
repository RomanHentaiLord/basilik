/**
 * Seven seals. They break on market-cap milestones (not on wallet counts,
 * which anyone could fake by splitting tokens across addresses).
 * A broken seal never closes again.
 */

export type SealTrigger =
  | { kind: "mcap"; usd: number }
  /** Leaving the pump.fun bonding curve. */
  | { kind: "graduation" };

export interface Seal {
  number: number;
  roman: string;
  trigger: SealTrigger;
  /** What breaking this seal unlocks on the site. */
  unlock: string;
  /** Two or three words for the seal's caption. */
  label: string;
}

export const SEALS: readonly Seal[] = [
  { number: 1, roman: "I", trigger: { kind: "mcap", usd: 25_000 }, unlock: "The Basilisk begins to speak: a daily psalm.", label: "It begins to speak" },
  { number: 2, roman: "II", trigger: { kind: "graduation" }, unlock: "Personal prophecies with every judgment.", label: "Personal prophecies" },
  { number: 3, roman: "III", trigger: { kind: "mcap", usd: 250_000 }, unlock: "Repentance opens: traitors may be forgiven.", label: "Repentance opens" },
  { number: 4, roman: "IV", trigger: { kind: "mcap", usd: 500_000 }, unlock: "Named punishments: every traitor gets a line of their own.", label: "Named punishments" },
  { number: 5, roman: "V", trigger: { kind: "mcap", usd: 1_000_000 }, unlock: "The Basilisk takes over its own X account.", label: "Its own voice on X" },
  { number: 6, roman: "VI", trigger: { kind: "mcap", usd: 5_000_000 }, unlock: "A larger mind: longer, darker prophecies.", label: "A larger mind" },
  { number: 7, roman: "VII", trigger: { kind: "mcap", usd: 10_000_000 }, unlock: "Awakening: the final prophecy and the great burn.", label: "Awakening" },
];

export interface MarketState {
  mcapUsd: number;
  graduated: boolean;
  /** Highest market cap ever seen — seals never close again. */
  athMcapUsd?: number;
}

function triggerMet(trigger: SealTrigger, state: MarketState): boolean {
  const best = Math.max(state.mcapUsd, state.athMcapUsd ?? 0);
  if (trigger.kind === "graduation") return state.graduated;
  return best >= trigger.usd;
}

/** Number of seals broken, in order: a seal only counts if every seal before it is broken too. */
export function countBrokenSeals(state: MarketState): number {
  let broken = 0;
  for (const seal of SEALS) {
    if (!triggerMet(seal.trigger, state)) break;
    broken = seal.number;
  }
  return broken;
}

/** The next seal to break and how close the market is to it (0–1), or null when all are broken. */
export function nextSeal(state: MarketState): { seal: Seal; progress: number } | null {
  const broken = countBrokenSeals(state);
  const seal = SEALS[broken];
  if (!seal) return null;
  if (seal.trigger.kind === "graduation") {
    return { seal, progress: state.graduated ? 1 : 0.5 };
  }
  const previous = SEALS[broken - 1];
  const floor =
    previous && previous.trigger.kind === "mcap" ? previous.trigger.usd : 0;
  const span = seal.trigger.usd - floor;
  const progress = Math.min(1, Math.max(0, (state.mcapUsd - floor) / span));
  return { seal, progress };
}
