import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import {
  burnsFromDb,
  loadEvents,
  richestFaithful,
  worstTraitors,
  type BurnEntry,
} from "@/db/books";
import { db } from "@/db";
import { RANKS, TOTAL_SUPPLY, type Rank } from "@/lib/basilisk/config";
import { judge } from "@/lib/basilisk/judge";
import type { Verdict } from "@/lib/basilisk/types";
import { sealsOverview } from "./basilisk";
import { demoAddress, demoVerdicts } from "./books";
import { tokenMint } from "./env";

/** One line of the Ledger of Offerings. */
export interface Offering extends BurnEntry {
  /** True when the Altar (the creator wallet) burned it. */
  altar: boolean;
}

export interface Devoted {
  address: string;
  title: string;
  rank: Rank;
  balance: number;
}

export interface Betrayer {
  address: string;
  title: string;
  amount: number | null;
  at: number | null;
}

export interface BurnsOverview {
  demo: boolean;
  /** The creator wallet: pump.fun pays it the creator fees, and it burns. Null until it is set. */
  altar: string | null;
  count: number;
  /** Tokens burned in total, and by whom. */
  total: number;
  altarTotal: number;
  holdersTotal: number;
  /** Share of the supply burned, 0–1. */
  share: number;
  /** Newest first, numbered from the first burn ever. */
  offerings: Offering[];
  topFaithful: Devoted[];
  worstTraitors: Betrayer[];
}

/** The creator wallet, set in ALTAR_WALLET once the coin exists. */
export function altarWallet(): string | null {
  return process.env.ALTAR_WALLET?.trim() || null;
}

const byOrder = (a: Devoted, b: Devoted) =>
  RANKS.indexOf(b.rank) - RANKS.indexOf(a.rank) || b.balance - a.balance;

function devoted(verdicts: Verdict[]): Devoted[] {
  return verdicts
    .filter((verdict) => verdict.book === "faithful" && verdict.rank !== null)
    .map((verdict) => ({
      address: verdict.address,
      title: verdict.title,
      rank: verdict.rank as Rank,
      balance: verdict.balance,
    }))
    .sort(byOrder)
    .slice(0, 3);
}

function totals(total: number, altarTotal: number) {
  return {
    total,
    altarTotal,
    holdersTotal: Math.max(0, total - altarTotal),
    share: total / TOTAL_SUPPLY,
  };
}

const EMPTY: BurnsOverview = {
  demo: false,
  altar: null,
  count: 0,
  total: 0,
  altarTotal: 0,
  holdersTotal: 0,
  share: 0,
  offerings: [],
  topFaithful: [],
  worstTraitors: [],
};

/** After launch: every burn of the coin, and the tops of both Books, from the database. */
async function liveBurns(): Promise<BurnsOverview> {
  "use cache";
  cacheTag("books");
  cacheLife("minutes");

  const altar = altarWallet();
  if (!db) return { ...EMPTY, altar };
  try {
    const exclude = altar ? [altar] : [];
    const [ledger, candidates, traitors, seals] = await Promise.all([
      burnsFromDb(db, 50),
      richestFaithful(db, 12, exclude),
      worstTraitors(db, 3, exclude),
      sealsOverview(),
    ]);

    // Ranks move with time (1 hour, 2 hours…): judge the biggest holders as of now.
    const histories = await loadEvents(db, candidates);
    const now = Date.now();
    const verdicts = candidates.map((address) => {
      const events = histories.get(address) ?? [];
      const balance = events.length > 0 ? events[events.length - 1].balanceAfter : 0;
      return judge({ address, balance, events }, { now, sealsBroken: seals.broken });
    });

    const offerings = ledger.entries.map((entry) => ({ ...entry, altar: entry.burner !== null && entry.burner === altar }));
    const altarTotal = altar ? (ledger.byBurner.get(altar) ?? 0) : 0;
    return {
      demo: false,
      altar,
      count: ledger.count,
      ...totals(ledger.total, altarTotal),
      offerings,
      topFaithful: devoted(verdicts),
      worstTraitors: traitors.map((row) => ({ address: row.address, title: row.punishment, amount: row.amount, at: row.at })),
    };
  } catch (error) {
    console.error("[burns] could not read the Ledger of Offerings", error);
    return { ...EMPTY, altar };
  }
}

const HOUR = 60 * 60 * 1000;

/** Before launch: a vision of the Ledger, with the same imaginary crowd as the Books. */
async function demoBurns(): Promise<BurnsOverview> {
  "use cache";
  cacheLife("hours");

  const verdicts = await demoVerdicts();
  const now = Date.now();
  const altar = demoAddress(9_999);
  const holders = verdicts.filter((verdict) => verdict.status === "faithful").slice(0, 3);

  // Three seals broken in the demo market: the Altar burned at each, and a few holders joined in.
  const plan: { hoursAgo: number; amount: number; burner: Verdict | null }[] = [
    { hoursAgo: 30, amount: 1_240_000, burner: null },
    { hoursAgo: 26, amount: 20_000, burner: holders[0] ?? null },
    { hoursAgo: 14, amount: 2_615_000, burner: null },
    { hoursAgo: 9, amount: 150_000, burner: holders[1] ?? null },
    { hoursAgo: 3, amount: 3_980_000, burner: null },
    { hoursAgo: 1, amount: 66_000, burner: holders[2] ?? null },
  ];
  const offerings: Offering[] = plan
    .map((item, index) => ({
      number: index + 1,
      signature: `demo-offering-${index + 1}`,
      burner: item.burner?.address ?? altar,
      amount: item.amount,
      at: now - item.hoursAgo * HOUR,
      title: item.burner?.title ?? null,
      status: item.burner?.status ?? null,
      altar: item.burner === null,
    }))
    .reverse();

  const total = offerings.reduce((sum, offering) => sum + offering.amount, 0);
  const altarTotal = offerings.filter((offering) => offering.altar).reduce((sum, offering) => sum + offering.amount, 0);
  const worst = verdicts
    .filter((verdict) => verdict.status === "traitor")
    .sort((a, b) => (b.betrayalAmount ?? 0) - (a.betrayalAmount ?? 0))
    .slice(0, 3)
    .map((verdict) => ({ address: verdict.address, title: verdict.title, amount: verdict.betrayalAmount, at: verdict.traitorAt }));

  return {
    demo: true,
    altar,
    count: offerings.length,
    ...totals(total, altarTotal),
    offerings,
    topFaithful: devoted(verdicts),
    worstTraitors: worst,
  };
}

/** The Ledger of Offerings: every burn, and the three most devoted and the three worst. */
export async function burnsOverview(): Promise<BurnsOverview> {
  return tokenMint() ? liveBurns() : demoBurns();
}
