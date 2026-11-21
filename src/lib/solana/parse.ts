import type { WalletEvent, WalletEventKind } from "@/lib/basilisk/types";

/**
 * Turns one `getTransaction` result (encoding: "jsonParsed") into a wallet event.
 * Pure function — tested with fixtures, no network.
 */

export interface TokenBalance {
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount: { amount: string; decimals: number };
}

export interface ParsedTransaction {
  blockTime: number | null;
  slot: number;
  meta: {
    err: unknown;
    fee: number;
    preBalances: number[];
    postBalances: number[];
    preTokenBalances?: TokenBalance[];
    postTokenBalances?: TokenBalance[];
  } | null;
  transaction: {
    signatures: string[];
    message: { accountKeys: ({ pubkey: string } | string)[] };
  };
}

/**
 * Closing an empty token account refunds its rent (~0.00204 SOL).
 * A SOL gain below this is a refund, not sale proceeds.
 */
export const RENT_REFUND_LAMPORTS = 2_100_000;

function keyAt(tx: ParsedTransaction, index: number): string | undefined {
  const key = tx.transaction.message.accountKeys[index];
  return typeof key === "string" ? key : key?.pubkey;
}

/** Sum of an owner's balances for one mint, in raw units. */
function ownerRaw(
  balances: TokenBalance[] | undefined,
  owner: string,
  mint: string,
): bigint {
  let total = BigInt(0);
  for (const balance of balances ?? []) {
    if (balance.mint === mint && balance.owner === owner) {
      total += BigInt(balance.uiTokenAmount.amount);
    }
  }
  return total;
}

function decimalsOf(tx: ParsedTransaction, mint: string): number {
  const all = [...(tx.meta?.preTokenBalances ?? []), ...(tx.meta?.postTokenBalances ?? [])];
  return all.find((balance) => balance.mint === mint)?.uiTokenAmount.decimals ?? 6;
}

/** Did the owner gain any token other than `mint` (WSOL, USDC…) in this transaction? */
function gainedOtherToken(tx: ParsedTransaction, owner: string, mint: string): boolean {
  const mints = new Set(
    [...(tx.meta?.preTokenBalances ?? []), ...(tx.meta?.postTokenBalances ?? [])]
      .filter((balance) => balance.owner === owner && balance.mint !== mint)
      .map((balance) => balance.mint),
  );
  for (const other of mints) {
    const delta =
      ownerRaw(tx.meta?.postTokenBalances, owner, other) -
      ownerRaw(tx.meta?.preTokenBalances, owner, other);
    if (delta > BigInt(0)) return true;
  }
  return false;
}

/** Did the owner spend any token other than `mint` in this transaction? */
function spentOtherToken(tx: ParsedTransaction, owner: string, mint: string): boolean {
  const mints = new Set(
    [...(tx.meta?.preTokenBalances ?? []), ...(tx.meta?.postTokenBalances ?? [])]
      .filter((balance) => balance.owner === owner && balance.mint !== mint)
      .map((balance) => balance.mint),
  );
  for (const other of mints) {
    const delta =
      ownerRaw(tx.meta?.postTokenBalances, owner, other) -
      ownerRaw(tx.meta?.preTokenBalances, owner, other);
    if (delta < BigInt(0)) return true;
  }
  return false;
}

/** Owner's SOL change in lamports, with the network fee added back if the owner paid it. */
function solDelta(tx: ParsedTransaction, owner: string): number {
  const meta = tx.meta;
  if (!meta) return 0;
  const keys = tx.transaction.message.accountKeys;
  for (let index = 0; index < keys.length; index++) {
    if (keyAt(tx, index) === owner) {
      const delta = (meta.postBalances[index] ?? 0) - (meta.preBalances[index] ?? 0);
      return index === 0 ? delta + meta.fee : delta;
    }
  }
  return 0;
}

/**
 * Classify the transaction from the owner's point of view.
 * Returns null when the owner's balance of `mint` did not change (or the tx failed).
 * `balanceAfter` is filled in later by the history builder.
 */
export function parseTransaction(
  tx: ParsedTransaction,
  owner: string,
  mint: string,
): Omit<WalletEvent, "balanceAfter"> | null {
  if (!tx.meta || tx.meta.err) return null;

  const delta =
    ownerRaw(tx.meta.postTokenBalances, owner, mint) -
    ownerRaw(tx.meta.preTokenBalances, owner, mint);
  if (delta === BigInt(0)) return null;

  const decimals = decimalsOf(tx, mint);
  const amount = Number(delta < BigInt(0) ? -delta : delta) / 10 ** decimals;
  const sol = solDelta(tx, owner);

  let kind: WalletEventKind;
  if (delta < BigInt(0)) {
    const received = sol > RENT_REFUND_LAMPORTS || gainedOtherToken(tx, owner, mint);
    kind = received ? "sell" : "out";
  } else {
    // A first buy also pays account rent, so any SOL spent beyond the fee counts as payment.
    const paid = sol < 0 || spentOtherToken(tx, owner, mint);
    kind = paid ? "buy" : "in";
  }

  return {
    signature: tx.transaction.signatures[0],
    at: (tx.blockTime ?? 0) * 1000,
    kind,
    amount,
  };
}
