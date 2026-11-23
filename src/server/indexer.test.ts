import { Keypair, PublicKey } from "@solana/web3.js";
import { beforeAll, describe, expect, it } from "vitest";
import {
  booksFromDb,
  burnsFromDb,
  entryOf,
  readState,
  recentTraitors,
  richestFaithful,
  tryLock,
  unlock,
  worstTraitors,
  type AnyDb,
} from "@/db/books";
import { testDb } from "@/db/test-db";
import { DAY_MS } from "@/lib/basilisk/config";
import type { ParsedTransaction, TokenBalance } from "@/lib/solana/parse";
import { CURSOR_KEY, isPersonalWallet, runIndexer, type ChainSource, type Cursor } from "./indexer-core";

const MINT = "Nt3dBasi1iskMint1111111111111111111111111pump";
const START = Date.UTC(2026, 10, 1);
const day = (n: number) => START + n * DAY_MS;

// Wallets are real ed25519 keys; the pool is a program address (off the curve).
let A = "";
let B = "";
let C = "";
let POOL = "";

async function wallet(): Promise<string> {
  return (await Keypair.generate()).publicKey.toBase58();
}

const raw = (tokens: number) => String(Math.round(tokens * 1e6));
const bal = (accountIndex: number, owner: string, tokens: number): TokenBalance => ({
  accountIndex,
  owner,
  mint: MINT,
  uiTokenAmount: { amount: raw(tokens), decimals: 6 },
});

/** A swap against the pool: `delta` tokens to the wallet (negative = sold), `sol` lamports to the wallet. */
function swap(signature: string, at: number, wallet: string, before: number, delta: number, sol: number): ParsedTransaction {
  const fee = 5_000;
  return {
    blockTime: at / 1000,
    slot: at / 1000,
    meta: {
      err: null,
      fee,
      preBalances: [10_000_000_000, 0],
      postBalances: [10_000_000_000 + sol - fee, 0],
      preTokenBalances: [bal(2, wallet, before), bal(3, POOL, 500_000_000)],
      postTokenBalances: [bal(2, wallet, before + delta), bal(3, POOL, 500_000_000 - delta)],
    },
    transaction: { signatures: [signature], message: { accountKeys: [{ pubkey: wallet }, { pubkey: "pool-vault" }] } },
  };
}

/** A plain transfer between two wallets: no SOL changes hands. */
function transfer(signature: string, at: number, from: string, fromBefore: number, to: string, toBefore: number, amount: number): ParsedTransaction {
  return {
    blockTime: at / 1000,
    slot: at / 1000,
    meta: {
      err: null,
      fee: 5_000,
      preBalances: [10_000_000_000, 10_000_000_000],
      postBalances: [10_000_000_000 - 5_000, 10_000_000_000],
      preTokenBalances: [bal(2, from, fromBefore), bal(3, to, toBefore)],
      postTokenBalances: [bal(2, from, fromBefore - amount), bal(3, to, toBefore + amount)],
    },
    transaction: { signatures: [signature], message: { accountKeys: [{ pubkey: from }, { pubkey: to }] } },
  };
}

/** Tokens burned by their owner, directly or inside another program (a burner app). */
function burn(signature: string, at: number, owner: string, before: number, amount: number, inner = false): ParsedTransaction {
  const instruction = {
    program: "spl-token",
    programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    parsed: {
      type: "burnChecked",
      info: { account: "owner-ata", mint: MINT, authority: owner, tokenAmount: { amount: raw(amount), decimals: 6 } },
    },
  };
  return {
    blockTime: at / 1000,
    slot: at / 1000,
    meta: {
      err: null,
      fee: 5_000,
      preBalances: [10_000_000_000, 2_039_280],
      postBalances: [10_000_000_000 - 5_000, 2_039_280],
      preTokenBalances: [bal(1, owner, before)],
      postTokenBalances: [bal(1, owner, before - amount)],
      innerInstructions: inner ? [{ index: 0, instructions: [instruction] }] : [],
    },
    transaction: {
      signatures: [signature],
      message: {
        accountKeys: [{ pubkey: owner }, { pubkey: "owner-ata" }],
        instructions: inner ? [{ programId: "BurnerApp1111111111111111111111111111111111" }] : [instruction],
      },
    },
  };
}

/** A chain in memory: signatures newest first, like getSignaturesForAddress. */
class FakeChain implements ChainSource {
  private list: string[] = [];
  private txs = new Map<string, ParsedTransaction>();
  calls = 0;

  add(tx: ParsedTransaction) {
    const signature = tx.transaction.signatures[0];
    this.txs.set(signature, tx);
    this.list.unshift(signature);
  }

  async signatures({ before, until, limit }: { before?: string; until?: string; limit: number }) {
    this.calls++;
    let start = before ? this.list.indexOf(before) + 1 : 0;
    if (start < 0) start = 0;
    let end = until ? this.list.indexOf(until) : this.list.length;
    if (end < 0) end = this.list.length;
    return this.list.slice(start, Math.min(end, start + limit)).map((signature) => ({ signature, err: null }));
  }

  async transactions(signatures: string[]) {
    return signatures.map((signature) => this.txs.get(signature) ?? null);
  }
}

describe("the sales indexer", () => {
  let db: AnyDb;
  const chain = new FakeChain();
  const run = (budget: number, now = day(10)) =>
    runIndexer({ db, mint: MINT, source: chain, now, sealsBroken: 3, budget });

  beforeAll(async () => {
    [A, B, C] = await Promise.all([wallet(), wallet(), wallet()]);
    const [pda] = await PublicKey.findProgramAddress([new TextEncoder().encode("pool")], new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"));
    POOL = pda.toBase58();
    db = await testDb();
    chain.add(swap("s1", day(1), A, 0, 1_000_000, -300_000_000));
    chain.add(swap("s2", day(2), B, 0, 30_000, -10_000_000));
    chain.add(swap("s3", day(3), C, 0, 10_000, -3_000_000));
    chain.add(swap("s4", day(4), A, 1_000_000, 500_000, -150_000_000));
    chain.add(transfer("s5", day(5), B, 30_000, C, 10_000, 5_000));
  });

  it("tells wallets from program accounts", () => {
    expect(isPersonalWallet(A)).toBe(true);
    expect(isPersonalWallet(POOL)).toBe(false);
  });

  it("first run reads the newest transactions and remembers where it stopped", async () => {
    const result = await run(3);
    expect(result.scanned).toBe(3);
    expect(result.cursor).toEqual({ head: "s5", tail: "s3", backfillDone: false });
  });

  it("later runs fill in the past until the first transaction", async () => {
    const result = await run(3);
    expect(result.scanned).toBe(2);
    expect(result.cursor).toEqual({ head: "s5", tail: "s1", backfillDone: true });
    expect(await readState<Cursor>(db, CURSOR_KEY)).toEqual(result.cursor);
  });

  it("judges every wallet that moved, and never the pool", async () => {
    const books = await booksFromDb(db);
    expect(books.faithful).toBe(2); // A (1.5M, Warden) and B (25K, a pet)
    expect(books.traitors).toBe(0);
    expect(books.latestFaithful.map((row) => row.address).sort()).toEqual([A, B].sort());
    expect(books.firstWitnesses.taken).toBe(2);
    expect(books.firstWitnesses.names[0].address).toBe(A);
    const entryA = await entryOf(db, A);
    const entryB = await entryOf(db, B);
    expect(entryA).toEqual({ number: 1, firstWitness: true });
    expect(entryB).toEqual({ number: 2, firstWitness: true });
    expect(await entryOf(db, C)).toBeNull(); // 15K: below the Book
    expect(await entryOf(db, POOL)).toBeNull();
  });

  it("a new sale above the head makes a traitor and shows in the feed", async () => {
    chain.add(swap("s6", day(9), A, 1_500_000, -1_450_000, 400_000_000));
    const result = await run(3);
    expect(result.scanned).toBe(1);
    expect(result.newTraitors).toEqual([A]);
    expect(result.cursor.head).toBe("s6");
    const feed = await recentTraitors(db);
    expect(feed[0]).toMatchObject({ address: A, amount: 1_450_000 });
    const books = await booksFromDb(db);
    expect(books.traitors).toBe(1);
    expect(books.latestTraitors[0].address).toBe(A);
    // The traitor keeps its place in history: it entered the Book first.
    expect((await entryOf(db, A))?.number).toBe(1);
  });

  it("an empty run changes nothing", async () => {
    const result = await run(3);
    expect(result).toMatchObject({ scanned: 0, events: 0, wallets: 0, newTraitors: [] });
  });

  it("a burst of activity is taken from the bottom up", async () => {
    for (let i = 7; i <= 11; i++) chain.add(swap(`s${i}`, day(9) + i * 60_000, B, 25_000 + (i - 7) * 1_000, 1_000, -1_000_000));
    const first = await run(2);
    expect(first.cursor.head).toBe("s8");
    const second = await run(2);
    expect(second.cursor.head).toBe("s10");
    const third = await run(2);
    expect(third.cursor.head).toBe("s11");
  });
});

describe("burns and the tops of both Books", () => {
  let db: AnyDb;
  const chain = new FakeChain();
  let ALTAR = "";

  beforeAll(async () => {
    [A, B, ALTAR] = await Promise.all([wallet(), wallet(), wallet()]);
    db = await testDb();
    chain.add(swap("t1", day(1), A, 0, 2_000_000, -600_000_000));
    chain.add(swap("t2", day(1) + 60_000, B, 0, 300_000, -90_000_000));
    chain.add(swap("t3", day(2), A, 2_000_000, -1_900_000, 500_000_000));
    chain.add(burn("burn-holder", day(3), B, 300_000, 50_000));
    chain.add(burn("burn-altar", day(4), ALTAR, 1_000_000, 1_000_000, true));
  });

  it("records every burn, the Altar's too, and numbers them from the first", async () => {
    const result = await runIndexer({ db, mint: MINT, source: chain, now: day(5), sealsBroken: 2, budget: 10, exclude: [ALTAR] });
    expect(result.burns).toBe(2);
    const { count, total, entries, byBurner } = await burnsFromDb(db);
    expect(count).toBe(2);
    expect(total).toBe(1_050_000);
    expect(entries.map((entry) => [entry.number, entry.signature])).toEqual([
      [2, "burn-altar"],
      [1, "burn-holder"],
    ]);
    // The holder is in the Book; the Altar is kept out of it.
    expect(entries[1]).toMatchObject({ burner: B, amount: 50_000, status: "faithful" });
    expect(entries[0]).toMatchObject({ burner: ALTAR, status: null });
    expect(byBurner.get(ALTAR)).toBe(1_000_000);
  });

  it("knows the biggest holders and the worst traitors", async () => {
    expect(await richestFaithful(db, 3)).toEqual([B]);
    expect((await worstTraitors(db, 3)).map((row) => [row.address, row.amount])).toEqual([[A, 1_900_000]]);
  });

  it("a second run stores nothing twice", async () => {
    await writeCursorBack(db);
    const result = await runIndexer({ db, mint: MINT, source: chain, now: day(5), sealsBroken: 2, budget: 10, exclude: [ALTAR] });
    expect(result.burns).toBe(0);
    expect((await burnsFromDb(db)).count).toBe(2);
  });
});

/** Forget where the indexer stopped, so the next run reads everything again. */
async function writeCursorBack(db: AnyDb) {
  const { writeState } = await import("@/db/books");
  await writeState(db, CURSOR_KEY, { head: null, tail: null, backfillDone: false });
}

describe("the indexer lock", () => {
  it("lets one run in at a time and frees itself", async () => {
    const db = await testDb();
    const now = new Date();
    expect(await tryLock(db, "lock", 60_000, now)).toBe(true);
    expect(await tryLock(db, "lock", 60_000, now)).toBe(false);
    expect(await tryLock(db, "lock", 60_000, new Date(now.getTime() + 61_000))).toBe(true);
    await unlock(db, "lock");
    expect(await tryLock(db, "lock", 60_000, now)).toBe(true);
  });
});
