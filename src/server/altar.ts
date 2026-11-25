import "server-only";
import { altarOfferings } from "@/db/books";
import { db } from "@/db";
import { SEALS } from "@/lib/basilisk/seals";
import { tokenAccountsFrom, type TokenAccount } from "@/lib/solana/burn";
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
  /** Seals break, trumpets sound. */
  kind: "seal" | "trumpet";
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
      seals: broken.map((seal) => ({
        number: seal.number,
        roman: seal.roman,
        label: seal.label,
        brokenAt: seal.brokenAt,
        answered: !mint,
        kind: "seal" as const,
      })),
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
    seals: [
      ...broken.map((seal) => ({
        number: seal.number,
        roman: seal.roman,
        label: seal.label,
        brokenAt: seal.brokenAt,
        answered: (offerings?.answered ?? 0) >= seal.number,
        kind: "seal" as const,
      })),
      // After the bond the Altar answers each trumpet too: stage 8 is the first trumpet.
      ...overview.trumpets.list
        .filter((trumpet) => trumpet.sounded)
        .map((trumpet) => ({
          number: SEALS.length + trumpet.number,
          roman: `Trumpet ${trumpet.roman}`,
          label: trumpet.label,
          brokenAt: trumpet.soundedAt,
          answered: (offerings?.answered ?? 0) >= SEALS.length + trumpet.number,
          kind: "trumpet" as const,
        })),
    ],
    lastOffering: offerings?.last ?? null,
  };
}
