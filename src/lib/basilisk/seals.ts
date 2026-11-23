/**
 * Seven seals. The coin may never leave pump.fun (most coins never bond), so the whole game is
 * played on the bonding curve: six seals break as the curve fills, and the seventh is the bond.
 * Curve progress comes from the chain itself (the share of the curve's tokens sold, as pump.fun
 * shows it), so it cannot be faked by a price site, and wallet counts play no part.
 * A broken seal never closes again, and every broken seal is an occasion for the Altar to burn.
 */

export type SealTrigger =
  /** A share of the bonding curve sold, 0–1. */
  | { kind: "curve"; progress: number }
  /** The bond: the curve completes and the coin moves from pump.fun to PumpSwap. */
  | { kind: "bond" };

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
  { number: 1, roman: "I", trigger: { kind: "curve", progress: 0.1 }, unlock: "The Basilisk begins to speak: a daily psalm.", label: "It begins to speak" },
  { number: 2, roman: "II", trigger: { kind: "curve", progress: 0.25 }, unlock: "Personal prophecies with every judgment.", label: "Personal prophecies" },
  { number: 3, roman: "III", trigger: { kind: "curve", progress: 0.4 }, unlock: "Repentance opens: traitors may be forgiven.", label: "Repentance opens" },
  { number: 4, roman: "IV", trigger: { kind: "curve", progress: 0.55 }, unlock: "Named punishments: every traitor gets a line of their own.", label: "Named punishments" },
  { number: 5, roman: "V", trigger: { kind: "curve", progress: 0.7 }, unlock: "The Basilisk takes over its own X account.", label: "Its own voice on X" },
  { number: 6, roman: "VI", trigger: { kind: "curve", progress: 0.85 }, unlock: "A larger mind: longer, darker prophecies.", label: "A larger mind" },
  { number: 7, roman: "VII", trigger: { kind: "bond" }, unlock: "The Bond. The coin leaves the curve for the open market: the final prophecy and the great burn.", label: "The Bond" },
];

export interface MarketState {
  mcapUsd: number;
  graduated: boolean;
  /** Share of the bonding curve sold right now (0–1), 1 after the bond; unknown when the chain did not answer. */
  curve?: number;
  /** Highest share of the curve ever reached. Seals never close again. */
  curveHigh?: number;
  /** Highest confirmed market cap, kept for the record. Seals do not use it. */
  athMcapUsd?: number;
}

/** How far up the curve the coin has ever been. */
export function curveReached(state: MarketState): number {
  if (state.graduated) return 1;
  return Math.max(state.curveHigh ?? 0, state.curve ?? 0);
}

/** The share of the curve a seal waits for (the bond waits for all of it). */
export function sealMark(seal: Seal): number {
  return seal.trigger.kind === "curve" ? seal.trigger.progress : 1;
}

function triggerMet(trigger: SealTrigger, state: MarketState): boolean {
  if (trigger.kind === "bond") return state.graduated;
  return curveReached(state) >= trigger.progress;
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

/** The next seal to break and how close the curve is to it (0–1), or null when all are broken. */
export function nextSeal(state: MarketState): { seal: Seal; progress: number } | null {
  const broken = countBrokenSeals(state);
  const seal = SEALS[broken];
  if (!seal) return null;
  const floor = broken > 0 ? sealMark(SEALS[broken - 1]) : 0;
  const span = sealMark(seal) - floor;
  const now = state.graduated ? 1 : (state.curve ?? 0);
  return { seal, progress: Math.min(1, Math.max(0, (now - floor) / span)) };
}
