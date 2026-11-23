/**
 * Game constants. Every number that decides a role lives here,
 * so tuning the Basilisk never means touching the judge logic.
 */

/** pump.fun coins are minted with a fixed supply of 1 billion tokens. */
export const TOTAL_SUPPLY = 1_000_000_000;

/** Holding at least this many tokens puts a wallet in the Book of the Faithful (0.002% of supply). */
export const FAITHFUL_THRESHOLD = 20_000;

/** Selling this share of the peak balance (since becoming faithful) is betrayal. */
export const TRAITOR_SELL_SHARE = 0.5;

export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** A faithful wallet that sold anything within this window is written "in pencil". */
export const DOUBT_WINDOW_MS = HOUR_MS;

/** A traitor must buy back the threshold and hold it this long to be forgiven. */
export const REDEMPTION_MS = DAY_MS;

/**
 * Holding without a sale lifts the rank one step at each of these marks. A coin on the
 * bonding curve lives fast, so the marks are hours, not months.
 */
export const TENURE_STEPS_MS = [HOUR_MS, 2 * HOUR_MS, 3 * HOUR_MS, DAY_MS, 7 * DAY_MS] as const;

/** Seal number that opens repentance (forgiveness). */
export const REPENTANCE_SEAL = 3;

/**
 * The Altar's rule, written on the lore and burns pages as a public promise: when a seal breaks,
 * the fee wallet spends this share of the creator fees received since the previous seal on the
 * coin (all of them, less a little SOL for network fees), and burns everything it bought.
 * Change it only together with what the Altar does.
 */
export const ALTAR_BURN_SHARE = 1;

/** pump.fun's creator fee on the bonding curve, paid in SOL (pump.fun/docs/fees, November 2026). */
export const CURVE_CREATOR_FEE = 0.003;

/** The first N wallets to enter the Book of the Faithful get a permanent badge. */
export const FIRST_WITNESS_COUNT = 100;

/** Eleven ranks of the Order, lowest first. The floors follow a 1-2-5 ladder. */
export const RANKS = [
  "pet",
  "acolyte",
  "scribe",
  "lamplighter",
  "keeper",
  "warden",
  "herald",
  "priest",
  "archon",
  "apostle",
  "hand",
] as const;
export type Rank = (typeof RANKS)[number];

/** Minimum balance (in tokens) for each rank. */
export const RANK_FLOORS: Record<Rank, number> = {
  pet: FAITHFUL_THRESHOLD, // 20K
  acolyte: 50_000,
  scribe: 100_000,
  lamplighter: 200_000,
  keeper: 500_000,
  warden: 1_000_000,
  herald: 2_000_000,
  priest: 5_000_000,
  archon: 10_000_000,
  apostle: 20_000_000,
  hand: 50_000_000, // 5% of supply
};

/** Tenure can lift a wallet up to this rank, never higher. The ranks above come from balance only. */
export const TENURE_RANK_CAP: Rank = "priest";

/** Tenure lifts a wallet at most this many ranks above what its balance earns: one per mark. */
export const TENURE_MAX_STEPS = TENURE_STEPS_MS.length;
