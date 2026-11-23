import { PublicKey, TransactionInstruction, TransactionMessage, VersionedTransaction, type Blockhash } from "@solana/web3.js";

/**
 * The Altar's burn: one BurnChecked per token account it holds the coin in. A real SPL burn
 * that lowers the supply, not a transfer to a dead address. Built unsigned on the server;
 * the Altar signs and sends it from Phantom.
 */

export const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

/** BurnChecked in both token programs. */
const BURN_CHECKED = 15;
const ZERO = BigInt(0);
const MAX_U64 = BigInt("18446744073709551615");

export interface TokenAccount {
  /** The token account itself (not the owner). */
  address: string;
  /** Token or Token-2022: whichever program owns the account. */
  program: string;
  /** Raw amount, in the smallest units. */
  amount: bigint;
  decimals: number;
}

/** [15, amount as u64 little-endian, decimals]. */
export function burnCheckedData(amount: bigint, decimals: number): Uint8Array {
  if (amount <= ZERO || amount > MAX_U64) throw new RangeError("burn amount out of range");
  const data = new Uint8Array(10);
  data[0] = BURN_CHECKED;
  new DataView(data.buffer).setBigUint64(1, amount, true);
  data[9] = decimals;
  return data;
}

/** Every token account with something in it, from getTokenAccountsByOwner (jsonParsed). */
export function tokenAccountsFrom(response: {
  value: {
    pubkey: string;
    account: { owner: string; data: { parsed?: { info?: { tokenAmount?: { amount: string; decimals: number } } } } };
  }[];
}): TokenAccount[] {
  return response.value
    .map((item) => {
      const amount = item.account.data.parsed?.info?.tokenAmount;
      return amount
        ? { address: item.pubkey, program: item.account.owner, amount: BigInt(amount.amount), decimals: amount.decimals }
        : null;
    })
    .filter((account): account is TokenAccount => account !== null && account.amount > ZERO)
    .filter((account) => account.program === TOKEN_PROGRAM || account.program === TOKEN_2022_PROGRAM);
}

/** An unsigned v0 transaction that burns everything in `accounts`, paid and signed by `owner`. */
export function burnAllTransaction({
  owner,
  mint,
  accounts,
  blockhash,
}: {
  owner: string;
  mint: string;
  accounts: TokenAccount[];
  blockhash: string;
}): Uint8Array {
  if (accounts.length === 0) throw new Error("nothing to burn");
  const ownerKey = new PublicKey(owner);
  const mintKey = new PublicKey(mint);
  const instructions = accounts.map(
    (account) =>
      new TransactionInstruction({
        programId: new PublicKey(account.program),
        keys: [
          { pubkey: new PublicKey(account.address), isSigner: false, isWritable: true },
          { pubkey: mintKey, isSigner: false, isWritable: true },
          { pubkey: ownerKey, isSigner: true, isWritable: false },
        ],
        data: Buffer.from(burnCheckedData(account.amount, account.decimals)),
      }),
  );
  const message = new TransactionMessage({ payerKey: ownerKey, recentBlockhash: blockhash as Blockhash, instructions }).compileToV0Message();
  return new VersionedTransaction(message).serialize();
}
