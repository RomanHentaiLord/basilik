import { beforeAll, describe, expect, it } from "vitest";
import { altarOfferings, saveBurns, saveEventRows, saveVerdicts, storedWallet, type AnyDb } from "./books";
import { testDb } from "./test-db";
import { judge } from "@/lib/basilisk/judge";

const ALTAR = "9PNAvPo3bTPMQEf1Yki8GjA4Ub7wiCZcrXjM16L3HDLS";
const HOLDER = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
const NOW = Date.UTC(2026, 10, 24, 12);
let db: AnyDb;

beforeAll(async () => {
  db = await testDb();
});

describe("the Altar's offerings", () => {
  it("answer every seal up to the one broken when the newest burn happened", async () => {
    expect(await altarOfferings(db, ALTAR)).toEqual({ answered: 0, count: 0, last: null });
    await saveBurns(db, [
      { signature: "burn-1", burner: ALTAR, amount: 1_000_000, at: NOW - 3_600_000, seal: 1 },
      { signature: "burn-2", burner: HOLDER, amount: 5_000, at: NOW - 1_800_000, seal: 2 },
      { signature: "burn-3", burner: ALTAR, amount: 2_500_000, at: NOW, seal: 3 },
    ]);
    expect(await altarOfferings(db, ALTAR)).toEqual({
      answered: 3,
      count: 2,
      last: { signature: "burn-3", amount: 2_500_000, at: NOW },
    });
  });
});

describe("a wallet as the Books keep it", () => {
  it("gives back the events and balance, so judging again needs no chain", async () => {
    expect(await storedWallet(db, HOLDER)).toBeNull();
    const events = [{ signature: "s1", at: NOW - 86_400_000, kind: "buy" as const, amount: 600_000, balanceAfter: 600_000 }];
    const verdict = judge({ address: HOLDER, balance: 600_000, events }, { now: NOW, sealsBroken: 3 });
    await saveEventRows(db, events.map((event) => ({ address: HOLDER, event })));
    await saveVerdicts(db, [verdict], "judge", new Date(NOW));

    const stored = await storedWallet(db, HOLDER);
    expect(stored).toMatchObject({ balance: 600_000, judgedAt: NOW });
    expect(judge({ address: HOLDER, balance: stored!.balance, events: stored!.events }, { now: NOW, sealsBroken: 3 })).toEqual(verdict);
  });
});
