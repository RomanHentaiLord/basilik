import "server-only";
import { PublicKey } from "@solana/web3.js";
import { cacheLife } from "next/cache";
import { demoHistory } from "@/lib/basilisk/demo";
import { fnv1a } from "@/lib/basilisk/flavor";
import { judge } from "@/lib/basilisk/judge";
import { countBrokenSeals } from "@/lib/basilisk/seals";
import type { Verdict } from "@/lib/basilisk/types";
import { DEMO_MARKET } from "@/lib/solana/market";
import { tokenMint } from "./basilisk";

export interface TraitorRow {
  address: string;
  amount: number | null;
  punishment: string;
  at: number | null;
}

export interface FaithfulRow {
  address: string;
  title: string;
  /** Forgiven wallets keep a scar in the Book. */
  scar: boolean;
}

export interface BooksOverview {
  demo: boolean;
  faithful: number;
  traitors: number;
  forgiven: number;
  latestFaithful: FaithfulRow[];
  latestTraitors: TraitorRow[];
}

/** How many imaginary wallets populate the Books before launch. */
const DEMO_WALLETS = 1543;

/** Deterministic, valid-looking Solana addresses (32 pseudo-random bytes, base58). */
function demoAddress(index: number): string {
  const bytes = new Uint8Array(32);
  let seed = fnv1a(`demo-wallet:${index}`);
  for (let i = 0; i < 32; i++) {
    seed = Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) >>> 0;
    seed = (seed ^ (seed >>> 12)) >>> 0;
    bytes[i] = seed & 0xff;
  }
  return new PublicKey(bytes).toBase58();
}

/**
 * Before launch: judge a fixed crowd of imaginary wallets with the real rules,
 * so the Books on the page agree with what the judge says for those addresses.
 * Cached for an hour — the result depends on "now" only by whole days.
 */
async function demoBooks(): Promise<BooksOverview> {
  "use cache";
  cacheLife("hours");

  const now = Date.now();
  const sealsBroken = countBrokenSeals(DEMO_MARKET);
  const verdicts: Verdict[] = [];
  for (let i = 0; i < DEMO_WALLETS; i++) {
    const address = demoAddress(i);
    verdicts.push(judge(demoHistory(address, now), { now, sealsBroken, demo: true }));
  }

  const traitors = verdicts
    .filter((verdict) => verdict.status === "traitor")
    .slice(0, 5)
    .map((verdict) => ({
      address: verdict.address,
      amount: verdict.betrayalAmount,
      punishment: verdict.title,
      at: verdict.traitorAt,
    }));

  const faithful = verdicts
    .filter((verdict) => verdict.status === "faithful" || verdict.status === "forgiven")
    .slice(0, 5)
    .map((verdict) => ({ address: verdict.address, title: verdict.title, scar: verdict.scar }));

  return {
    demo: true,
    faithful: verdicts.filter((verdict) => verdict.book === "faithful").length,
    traitors: verdicts.filter((verdict) => verdict.status === "traitor").length,
    forgiven: verdicts.filter((verdict) => verdict.status === "forgiven").length,
    latestFaithful: faithful,
    latestTraitors: traitors,
  };
}

/** Counters and the latest traitors. Real data arrives in stage 2 (database + indexer). */
export async function booksOverview(): Promise<BooksOverview> {
  if (!tokenMint()) return demoBooks();
  return { demo: false, faithful: 0, traitors: 0, forgiven: 0, latestFaithful: [], latestTraitors: [] };
}
