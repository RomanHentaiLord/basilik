/**
 * Game constants. Every number that decides a role lives here,
 * so tuning the Basilisk never means touching the judge logic.
 */

/** pump.fun coins are minted with a fixed supply of 1 billion tokens. */
export const TOTAL_SUPPLY = 1_000_000_000;

/** Holding at least this many tokens puts a wallet in the Book of the Faithful (0.01% of supply). */
export const FAITHFUL_THRESHOLD = 100_000;

/** Selling this share of the peak balance (since becoming faithful) is betrayal. */
export const TRAITOR_SELL_SHARE = 0.5;

/** A faithful wallet that sold anything within this window is written "in pencil". */
export const DOUBT_WINDOW_DAYS = 7;

/** A traitor must buy back the threshold and hold it this long to be forgiven. */
export const REDEMPTION_DAYS = 7;

/** Every full period of holding without selling lifts the rank by one step. */
export const TENURE_STEP_DAYS = 30;

/** Seal number that opens repentance (forgiveness). */
export const REPENTANCE_SEAL = 3;

/** The first N wallets to enter the Book of the Faithful get a permanent badge. */
export const FIRST_WITNESS_COUNT = 100;

export const DAY_MS = 24 * 60 * 60 * 1000;

export const RANKS = ["pet", "keeper", "priest", "apostle"] as const;
export type Rank = (typeof RANKS)[number];

/** Minimum balance (in tokens) for each rank, from lowest to highest. */
export const RANK_FLOORS: Record<Rank, number> = {
  pet: FAITHFUL_THRESHOLD, // 100k – 1M
  keeper: 1_000_000, // 1M – 5M
  priest: 5_000_000, // 5M – 10M
  apostle: 10_000_000, // 10M+ (1% of supply)
};

/** Tenure can lift a wallet up to this rank, never higher. Apostle is earned by balance only. */
export const TENURE_RANK_CAP: Rank = "priest";
