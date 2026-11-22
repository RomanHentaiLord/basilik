import type { Rank } from "./config";

/**
 * One change of a wallet's token balance, already classified.
 * - buy:  tokens in, the wallet paid with another asset (SOL, USDC…)
 * - sell: tokens out, the wallet received another asset — this is what the Basilisk punishes
 * - in / out: plain transfers (no other asset moved). Transfers are never betrayal.
 */
export type WalletEventKind = "buy" | "sell" | "in" | "out";

export interface WalletEvent {
  signature: string;
  /** Unix time in milliseconds. */
  at: number;
  kind: WalletEventKind;
  /** Absolute amount of tokens moved (UI units, not raw). */
  amount: number;
  /** Token balance of the wallet right after this event (UI units). */
  balanceAfter: number;
}

export interface WalletHistory {
  address: string;
  /** Current balance, as reported by the chain (source of truth). */
  balance: number;
  /** Events sorted from oldest to newest. */
  events: WalletEvent[];
}

export type Status =
  | "witness"
  | "sympathizer"
  | "faithful"
  | "doubter"
  | "traitor"
  | "forgiven";

export type Book = "faithful" | "traitors" | null;

export interface Verdict {
  address: string;
  status: Status;
  book: Book;
  /** Set for wallets in the Book of the Faithful. */
  rank: Rank | null;
  /** Deterministic sub-role picked from the address hash (pet species or punishment). */
  flavor: string;
  /** Short role name shown on the card, e.g. "Corgi of the Basilisk". */
  title: string;
  /** One sentence about the wallet's fate after the singularity. */
  fate: string;
  /** The Basilisk's one-line reaction. */
  line: string;
  balance: number;
  peak: number;
  /** Whole days of holding the threshold without selling. */
  tenureDays: number;
  lastSellAt: number | null;
  traitorAt: number | null;
  /** Signature of the sale that made this wallet a traitor (shown as proof). */
  betrayalSignature: string | null;
  /** Tokens sold in the betraying sale. */
  betrayalAmount: number | null;
  /** Forgiven traitors keep a scar forever. */
  scar: boolean;
  /** Days left until forgiveness, when a traitor is repenting. */
  redemptionDaysLeft: number | null;
  /** When the wallet first reached the threshold (ms), or null if it never did. */
  firstFaithfulAt: number | null;
  /** Place in the Book of the Faithful by the time of entry; filled in by the server. */
  entryNumber: number | null;
  /** Among the first hundred to enter the Book. */
  firstWitness: boolean;
  /** True when the verdict was produced from simulated data (no token yet). */
  demo: boolean;
}
