import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnyDb } from "@/db/books";
import { testDb } from "@/db/test-db";
import { saveBurns } from "@/db/books";
import { bookBalance, cachedProphecy, offeredBy, readPsalm, saveProphecy, sealRecords, trumpetRecords } from "@/db/voice";
import { DAY_MS } from "@/lib/basilisk/config";
import { judge } from "@/lib/basilisk/judge";
import { personalProphecy, sealProphecy, trumpetProphecy } from "@/lib/basilisk/prophecy";
import type { WalletEvent } from "@/lib/basilisk/types";

// The voice runs on the server; here it gets an in-memory Postgres and a fake model.
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  db: null as unknown,
  awake: false,
  toWallet: vi.fn(),
  seal: vi.fn(),
  trumpet: vi.fn(),
  psalm: vi.fn(),
}));
vi.mock("@/db", () => ({
  get db() {
    return state.db;
  },
}));
vi.mock("./oracle", () => ({
  oracleAwake: () => state.awake,
  speakToWallet: state.toWallet,
  speakSeal: state.seal,
  speakTrumpet: state.trumpet,
  speakPsalm: state.psalm,
}));

const { readVoice, speakAfterPass, walletProphecy } = await import("./voice");

const NOW = Date.UTC(2026, 10, 24, 12, 0, 0);
const ADDRESS = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
let db: AnyDb;

function verdictOf(steps: [WalletEvent["kind"], number, number][], sealsBroken = 3) {
  let balance = 0;
  const events = steps.map(([kind, amount, daysAgo], i) => {
    balance += kind === "buy" ? amount : -amount;
    return { signature: `sig-${i}`, at: NOW - daysAgo * DAY_MS, kind, amount, balanceAfter: balance };
  });
  return judge({ address: ADDRESS, balance, events }, { now: NOW, sealsBroken });
}

beforeAll(async () => {
  db = await testDb();
});

beforeEach(async () => {
  state.db = db;
  state.awake = false;
  for (const fn of [state.toWallet, state.seal, state.trumpet, state.psalm]) fn.mockReset().mockResolvedValue(null);
  await db.execute("delete from burns");
  await db.execute("delete from seals");
  await db.execute("delete from prophecies");
  await db.execute("delete from indexer_state");
  await db.execute("delete from wallets");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("after an indexer pass", () => {
  it("writes each broken seal once, with its prophecy", async () => {
    state.seal.mockImplementation(async (seal: number) =>
      seal === 2 ? { faithful: "The model, to the Faithful.", traitors: "The model, to the Traitors." } : null,
    );
    const first = await speakAfterPass(db, { now: NOW, broken: 2, mcapUsd: 9_000 });
    expect(first.sealsSpoken).toEqual([1, 2]);
    expect(first.psalm).toBe("written");

    const records = await sealRecords(db);
    expect(records.map((r) => r.number)).toEqual([1, 2]);
    expect(records[0].words).toEqual(sealProphecy(1));
    expect(records[1].words?.faithful).toBe("The model, to the Faithful.");
    expect(records[1].brokenAt).toBe(NOW);

    // The next pass finds nothing new: seals speak once, the psalm once a day.
    const again = await speakAfterPass(db, { now: NOW + 60_000, broken: 2, mcapUsd: 9_500 });
    expect(again.sealsSpoken).toEqual([]);
    expect(again.psalm).toBe("kept");
    expect(state.seal).toHaveBeenCalledTimes(2);
  });

  it("keeps quiet before the first seal", async () => {
    const pass = await speakAfterPass(db, { now: NOW, broken: 0, mcapUsd: 3_000 });
    expect(pass).toMatchObject({ sealsSpoken: [], psalm: "none" });
    expect(await readPsalm(db, "2026-11-24")).toBeNull();
  });

  it("uses the model's psalm when it answers, and the written one when it does not", async () => {
    state.psalm.mockResolvedValueOnce("Hold, and be held, said the model.");
    await speakAfterPass(db, { now: NOW, broken: 1, mcapUsd: 5_000 });
    expect(await readPsalm(db, "2026-11-24")).toMatchObject({ text: "Hold, and be held, said the model.", source: "model" });

    await speakAfterPass(db, { now: NOW + DAY_MS, broken: 1, mcapUsd: 5_000 });
    expect(await readPsalm(db, "2026-11-25")).toMatchObject({ source: "template" });
  });

  it("turns grim when the curve fell back from its high", async () => {
    const pass = await speakAfterPass(db, { now: NOW, broken: 3, mcapUsd: 5_000, curve: 0.3, curveHigh: 0.45 });
    expect(pass.mood).toBe("grim");
    expect((await sealRecords(db))[2].words).toEqual(sealProphecy(3, "grim"));
  });
});

describe("after the bond", () => {
  it("sounds each trumpet once, with its prophecy", async () => {
    state.trumpet.mockImplementation(async (n: number) => (n === 2 ? { faithful: "Model words.", traitors: "Model red words." } : null));
    const pass = await speakAfterPass(db, { now: NOW, broken: 7, trumpets: 2, mcapUsd: 2_600_000 });
    expect(pass.trumpetsSounded).toEqual([1, 2]);
    const records = await trumpetRecords(db);
    expect(records[1]).toMatchObject({ soundedAt: NOW, words: trumpetProphecy(1) });
    expect(records[2].words.faithful).toBe("Model words.");

    const again = await speakAfterPass(db, { now: NOW + 60_000, broken: 7, trumpets: 3, mcapUsd: 5_100_000 });
    expect(again.trumpetsSounded).toEqual([3]);
    expect((await trumpetRecords(db))[1].soundedAt).toBe(NOW);
  });

  it("counts the tokens a wallet burned itself", async () => {
    await saveBurns(db, [
      { signature: "o1", burner: ADDRESS, amount: 15_000, at: NOW, seal: 2 },
      { signature: "o2", burner: ADDRESS, amount: 10_000, at: NOW, seal: 3 },
      { signature: "o3", burner: "someone-else", amount: 99_000, at: NOW, seal: 3 },
    ]);
    expect(await offeredBy(db, ADDRESS)).toBe(25_000);
  });
});

describe("the page's voice", () => {
  it("reads the seals' words from the database and fills the rest from the written ones", async () => {
    state.seal.mockResolvedValueOnce({ faithful: "Stored words.", traitors: "Stored red words." });
    await speakAfterPass(db, { now: NOW, broken: 1, mcapUsd: 5_000 });
    const voice = await readVoice(2, { demo: false }, NOW);
    expect(voice.words[1].faithful).toBe("Stored words.");
    expect(voice.words[2]).toEqual(sealProphecy(2));
    expect(voice.brokenAt[1]).toBe(NOW);
    expect(voice.psalm?.day).toBe("2026-11-24");
  });

  it("has no psalm before the first seal", async () => {
    expect((await readVoice(0, { demo: false }, NOW)).psalm).toBeNull();
  });
});

describe("a wallet's prophecy", () => {
  const voice = (broken: number) => ({ broken, mood: "calm" as const, words: {} });

  it("is silence while every seal is whole", async () => {
    const prophecy = await walletProphecy(verdictOf([["buy", 600_000, 3]], 0), voice(0));
    expect(prophecy).toMatchObject({ label: null, punishment: null });
  });

  it("is the seal's word to its Book at the first seal", async () => {
    const traitor = verdictOf([["buy", 600_000, 5], ["sell", 300_000, 1]], 1);
    expect((await walletProphecy(traitor, voice(1))).text).toBe(sealProphecy(1).traitors);
  });

  it("becomes personal from the second seal", async () => {
    const verdict = verdictOf([["buy", 600_000, 3]], 2);
    const prophecy = await walletProphecy(verdict, voice(2));
    expect(prophecy.label).toBe("Your prophecy, at the second seal");
    expect(prophecy.text).toBe(personalProphecy(verdict, 2));
    expect(state.toWallet).not.toHaveBeenCalled();
  });

  it("names a traitor's punishment from the fourth seal", async () => {
    const traitor = verdictOf([["buy", 600_000, 5], ["sell", 300_000, 1]], 4);
    expect((await walletProphecy(traitor, voice(3))).punishment).toBeNull();
    expect((await walletProphecy(traitor, voice(4))).punishment).toContain("7xKX…gAsU");
  });

  it("asks the model once per seal and status, and keeps its words", async () => {
    state.awake = true;
    state.toWallet.mockResolvedValue("It has saved you a seat by the warm fans.");
    const verdict = verdictOf([["buy", 600_000, 3]], 3);
    const first = await walletProphecy(verdict, voice(3));
    expect(first.text).toBe(`7xKX…gAsU, ${verdict.title}. It has saved you a seat by the warm fans.`);
    const second = await walletProphecy(verdict, voice(3));
    expect(second.text).toBe(first.text);
    expect(state.toWallet).toHaveBeenCalledTimes(1);

    // The wallet sold: new words for the new status.
    state.toWallet.mockResolvedValue("It saw the sale.");
    const traitor = verdictOf([["buy", 600_000, 5], ["sell", 300_000, 1]], 3);
    expect((await walletProphecy(traitor, voice(3))).text).toContain("It saw the sale.");
    expect(await cachedProphecy(db, ADDRESS, 3, "traitor")).toContain("It saw the sale.");
  });

  it("keeps the written words when the model fails, so they do not change later", async () => {
    state.awake = true;
    const verdict = verdictOf([["buy", 600_000, 3]], 2);
    const first = await walletProphecy(verdict, voice(2));
    expect(first.text).toBe(personalProphecy(verdict, 2));
    state.toWallet.mockResolvedValue("Different words now.");
    expect((await walletProphecy(verdict, voice(2))).text).toBe(first.text);
  });

  it("does not spend a model call on wallets outside the Books", async () => {
    state.awake = true;
    await walletProphecy(verdictOf([], 3), voice(3));
    expect(state.toWallet).not.toHaveBeenCalled();
  });
});

describe("the mood's ledger", () => {
  it("counts wallets that went into ink and into red since a moment", async () => {
    await saveProphecy(db, { address: ADDRESS, seal: 2, status: "faithful", text: "x" });
    await db.execute(`insert into wallets (address, status, flavor, first_faithful_at) values ('a', 'faithful', 'corgi', now()), ('b', 'faithful', 'cat', now())`);
    await db.execute(`insert into wallets (address, status, flavor, traitor_at) values ('c', 'traitor', 'eternal-captcha', now())`);
    expect(await bookBalance(db, Date.now() - DAY_MS)).toEqual({ newFaithful: 2, newTraitors: 1 });
  });
});
