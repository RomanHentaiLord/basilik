import { PublicKey } from "@solana/web3.js";
import type { WalletEvent, WalletHistory } from "@/lib/basilisk/types";
import { parseTransaction, type ParsedTransaction } from "./parse";
import { getTransactions, rpc } from "./rpc";

const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022_PROGRAM = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const ASSOCIATED_TOKEN_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

/** Hard cap so one hyperactive wallet cannot burn the RPC budget. */
const MAX_SIGNATURES = 1000;
const TX_BATCH = 20;

interface SignatureInfo {
  signature: string;
  err: unknown;
}

interface TokenAccountsResult {
  value: {
    pubkey: string;
    account: { data: { parsed: { info: { tokenAmount: { uiAmount: number | null; amount: string; decimals: number } } } } };
  }[];
}

async function associatedTokenAccount(
  owner: PublicKey,
  mint: PublicKey,
  tokenProgram: PublicKey,
): Promise<string> {
  const [address] = await PublicKey.findProgramAddress(
    [owner.toBytes(), tokenProgram.toBytes(), mint.toBytes()],
    ASSOCIATED_TOKEN_PROGRAM,
  );
  return address.toBase58();
}

/** Current balance of `mint` held by `owner`, in UI units, plus the live token accounts. */
async function currentBalance(owner: string, mint: string) {
  const result = await rpc<TokenAccountsResult>("getTokenAccountsByOwner", [
    owner,
    { mint },
    { encoding: "jsonParsed", commitment: "confirmed" },
  ]);
  let balance = 0;
  for (const item of result.value) {
    const amount = item.account.data.parsed.info.tokenAmount;
    balance += Number(amount.amount) / 10 ** amount.decimals;
  }
  return { balance, accounts: result.value.map((item) => item.pubkey) };
}

async function signaturesFor(account: string): Promise<string[]> {
  const out: string[] = [];
  let before: string | undefined;
  while (out.length < MAX_SIGNATURES) {
    const page = await rpc<SignatureInfo[]>("getSignaturesForAddress", [
      account,
      { limit: 1000, before, commitment: "confirmed" },
    ]);
    for (const info of page) if (!info.err) out.push(info.signature);
    if (page.length < 1000) break;
    before = page[page.length - 1].signature;
  }
  return out;
}

/**
 * Full history of one wallet for one token.
 * Looks at the owner's token accounts (including closed associated accounts,
 * whose history stays on chain), loads every transaction and classifies it.
 */
export async function getWalletHistory(
  ownerAddress: string,
  mintAddress: string,
): Promise<WalletHistory> {
  const owner = new PublicKey(ownerAddress);
  const mint = new PublicKey(mintAddress);

  const [{ balance, accounts }, ata, ata2022] = await Promise.all([
    currentBalance(ownerAddress, mintAddress),
    associatedTokenAccount(owner, mint, TOKEN_PROGRAM),
    associatedTokenAccount(owner, mint, TOKEN_2022_PROGRAM),
  ]);

  const tokenAccounts = [...new Set([ata, ata2022, ...accounts])];
  const signatureLists = await Promise.all(tokenAccounts.map(signaturesFor));
  const signatures = [...new Set(signatureLists.flat())].slice(0, MAX_SIGNATURES);

  const transactions = (await getTransactions<ParsedTransaction>(signatures, TX_BATCH)).filter(
    (tx): tx is ParsedTransaction => tx !== null,
  );

  transactions.sort((a, b) => a.slot - b.slot);

  const events: WalletEvent[] = [];
  let running = 0;
  for (const tx of transactions) {
    const parsed = parseTransaction(tx, ownerAddress, mintAddress);
    if (!parsed) continue;
    running += parsed.kind === "buy" || parsed.kind === "in" ? parsed.amount : -parsed.amount;
    events.push({ ...parsed, balanceAfter: Math.max(0, running) });
  }

  return { address: ownerAddress, balance, events };
}
