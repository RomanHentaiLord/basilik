import "server-only";
import { altarOfferings } from "@/db/books";
import { db } from "@/db";
import { burnAllTransaction, tokenAccountsFrom, type TokenAccount } from "@/lib/solana/burn";
import { rpc } from "@/lib/solana/rpc";
import { sealsOverview } from "./basilisk";
import { altarWallet } from "./burns";
import { tokenMint } from "./env";

const LAMPORTS = 1e9;

type TokenAccountsResponse = Parameters<typeof tokenAccountsFrom>[0];

/** The Altar's token accounts holding the coin, straight from the chain. */
async function altarAccounts(altar: string, mint: string): Promise<TokenAccount[]> {
  const response = await rpc<TokenAccountsResponse>("getTokenAccountsByOwner", [
    altar,
    { mint },
    { encoding: "jsonParsed", commitment: "confirmed" },
  ]);
  return tokenAccountsFrom(response);
}

const uiAmount = (accounts: TokenAccount[]) =>
  accounts.reduce((sum, account) => sum + Number(account.amount) / 10 ** account.decimals, 0);

export interface AltarSeal {
  number: number;
  roman: string;
  label: string;
  /** When the indexer saw it break (ms), if it did. */
  brokenAt: number | null;
  /** An offering was burned after it broke. */
  answered: boolean;
}

export interface AltarOverview {
  demo: boolean;
  /** ALTAR_WALLET, or null until it is set. */
  altar: string | null;
  /** What the Altar holds now; null when the chain did not answer. */
  sol: number | null;
  tokens: number | null;
  /** Broken seals, oldest first, and whether the Altar has answered each. */
  seals: AltarSeal[];
  lastOffering: { signature: string; amount: number; at: number } | null;
}

/** The Altar's page: what it holds, and which broken seals still wait for an offering. */
export async function altarOverview(): Promise<AltarOverview> {
  const altar = altarWallet();
  const mint = tokenMint();
  const overview = await sealsOverview();
  const broken = overview.seals.filter((seal) => seal.broken);

  if (!mint || !altar) {
    // Before launch: the demo Altar has answered every seal.
    return {
      demo: !mint,
      altar,
      sol: null,
      tokens: null,
      seals: broken.map((seal) => ({ number: seal.number, roman: seal.roman, label: seal.label, brokenAt: seal.brokenAt, answered: !mint })),
      lastOffering: null,
    };
  }

  const [holdings, offerings] = await Promise.all([
    Promise.all([rpc<{ value: number }>("getBalance", [altar, { commitment: "confirmed" }]), altarAccounts(altar, mint)])
      .then(([balance, accounts]) => ({ sol: balance.value / LAMPORTS, tokens: uiAmount(accounts) }))
      .catch((error) => {
        console.error("[altar] could not read the Altar's balance", error);
        return { sol: null, tokens: null };
      }),
    db
      ? altarOfferings(db, altar).catch((error) => {
          console.error("[altar] could not read the offerings", error);
          return null;
        })
      : Promise.resolve(null),
  ]);

  return {
    demo: false,
    altar,
    ...holdings,
    seals: broken.map((seal) => ({
      number: seal.number,
      roman: seal.roman,
      label: seal.label,
      brokenAt: seal.brokenAt,
      answered: (offerings?.answered ?? 0) >= seal.number,
    })),
    lastOffering: offerings?.last ?? null,
  };
}

export class AltarError extends Error {}

/**
 * An unsigned transaction that burns every token the Altar holds. Only for the Altar itself:
 * Phantom signs and sends it, so the server never sees a key.
 */
export async function prepareBurn(owner: string): Promise<{ transaction: string; tokens: number }> {
  const altar = altarWallet();
  const mint = tokenMint();
  if (!mint || !altar) throw new AltarError("The Altar is not consecrated yet: the coin or ALTAR_WALLET is not set.");
  if (owner !== altar) throw new AltarError("Only the Altar can make an offering here.");

  const accounts = await altarAccounts(altar, mint);
  if (accounts.length === 0) throw new AltarError("The Altar holds none of the coin. Buy it with the fees first.");
  const { value } = await rpc<{ value: { blockhash: string } }>("getLatestBlockhash", [{ commitment: "confirmed" }]);
  const bytes = burnAllTransaction({ owner: altar, mint, accounts, blockhash: value.blockhash });
  return { transaction: Buffer.from(bytes).toString("base64"), tokens: uiAmount(accounts) };
}
