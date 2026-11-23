import "server-only";
import { PublicKey } from "@solana/web3.js";
import { cacheLife, cacheTag } from "next/cache";
import { booksFromDb, recentTraitors, type BooksOverview, type FeedItem } from "@/db/books";
import { db } from "@/db";
import { FIRST_WITNESS_COUNT } from "@/lib/basilisk/config";
import { demoHistory } from "@/lib/basilisk/demo";
import { fnv1a } from "@/lib/basilisk/flavor";
import { judge } from "@/lib/basilisk/judge";
import { countBrokenSeals } from "@/lib/basilisk/seals";
import type { Verdict } from "@/lib/basilisk/types";
import { DEMO_MARKET } from "@/lib/solana/market";
import { tokenMint } from "./env";

export type { BooksOverview, FaithfulRow, FeedItem, TraitorRow } from "@/db/books";

/** How many imaginary wallets populate the Books before launch. */
const DEMO_WALLETS = 1543;

/** Deterministic, valid-looking Solana addresses (32 pseudo-random bytes, base58). */
export function demoAddress(index: number): string {
  const bytes = new Uint8Array(32);
  let seed = fnv1a(`demo-wallet:${index}`);
  for (let i = 0; i < 32; i++) {
    seed = Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) >>> 0;
    seed = (seed ^ (seed >>> 12)) >>> 0;
    bytes[i] = seed & 0xff;
  }
  return new PublicKey(bytes).toBase58();
}

const EMPTY: BooksOverview = {
  demo: false,
  faithful: 0,
  traitors: 0,
  forgiven: 0,
  latestFaithful: [],
  latestTraitors: [],
  firstWitnesses: { taken: 0, names: [] },
};

/**
 * Before launch: judge a fixed crowd of imaginary wallets with the real rules,
 * so the Books on the page agree with what the judge says for those addresses.
 * Cached for an hour: tenure moves in hours, so the demo ranks may lag by one mark.
 */
export async function demoVerdicts(): Promise<Verdict[]> {
  "use cache";
  cacheLife("hours");

  const now = Date.now();
  const sealsBroken = countBrokenSeals(DEMO_MARKET);
  const verdicts: Verdict[] = [];
  for (let i = 0; i < DEMO_WALLETS; i++) {
    const address = demoAddress(i);
    verdicts.push(judge(demoHistory(address, now), { now, sealsBroken, demo: true }));
  }
  return verdicts;
}

async function demoBooks(): Promise<BooksOverview> {
  "use cache";
  cacheLife("hours");

  const verdicts = await demoVerdicts();
  const traitors = verdicts
    .filter((verdict) => verdict.status === "traitor")
    .sort((a, b) => (b.traitorAt ?? 0) - (a.traitorAt ?? 0))
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

  const entered = verdicts.filter((verdict) => verdict.firstFaithfulAt !== null);
  const first = [...entered]
    .sort((a, b) => (a.firstFaithfulAt ?? 0) - (b.firstFaithfulAt ?? 0))
    .slice(0, 3)
    .map((verdict) => ({ address: verdict.address, title: verdict.title }));

  return {
    demo: true,
    faithful: verdicts.filter((verdict) => verdict.book === "faithful").length,
    traitors: verdicts.filter((verdict) => verdict.status === "traitor").length,
    forgiven: verdicts.filter((verdict) => verdict.status === "forgiven").length,
    latestFaithful: faithful,
    latestTraitors: traitors,
    firstWitnesses: { taken: Math.min(FIRST_WITNESS_COUNT, entered.length), names: first },
  };
}

/** The Books after launch, from the database. Refreshed by the indexer through the "books" tag. */
async function liveBooks(): Promise<BooksOverview> {
  "use cache";
  cacheTag("books");
  cacheLife("minutes");

  if (!db) return EMPTY;
  try {
    return await booksFromDb(db);
  } catch (error) {
    console.error("[books] could not read the Books", error);
    return EMPTY;
  }
}

/** Counters, the newest names in both Books and the First Witnesses. */
export async function booksOverview(): Promise<BooksOverview> {
  return tokenMint() ? liveBooks() : demoBooks();
}

async function liveFeed(): Promise<FeedItem[]> {
  "use cache";
  cacheTag("books");
  cacheLife("seconds");

  if (!db) return [];
  try {
    return await recentTraitors(db, 8);
  } catch (error) {
    console.error("[feed] could not read the traitors", error);
    return [];
  }
}

/** The newest traitors, for the "New traitor" notes on the page. */
export async function feedOverview(): Promise<{ demo: boolean; items: FeedItem[] }> {
  if (tokenMint()) return { demo: false, items: await liveFeed() };
  const books = await demoBooks();
  return {
    demo: true,
    items: books.latestTraitors.map((row) => ({
      address: row.address,
      title: row.punishment,
      amount: row.amount,
      at: row.at ?? 0,
    })),
  };
}
