import { describe, expect, it } from "vitest";
import { DAY_MS } from "./config";
import { demoHistory, demoScenario } from "./demo";
import { applyTenure, judge, rankByBalance } from "./judge";
import type { WalletEvent, WalletHistory } from "./types";

const NOW = Date.UTC(2026, 10, 21, 12, 0, 0);
const ADDRESS = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
const daysAgo = (n: number) => NOW - n * DAY_MS;

/** Build a history from [kind, amount, daysAgo] steps; balanceAfter is computed. */
function history(steps: [WalletEvent["kind"], number, number][]): WalletHistory {
  let balance = 0;
  const events = steps.map(([kind, amount, ago], i) => {
    balance += kind === "buy" || kind === "in" ? amount : -amount;
    return { signature: `sig-${i}`, at: daysAgo(ago), kind, amount, balanceAfter: balance };
  });
  return { address: ADDRESS, balance, events };
}

const run = (h: WalletHistory, sealsBroken = 3) => judge(h, { now: NOW, sealsBroken });

describe("chain of checks", () => {
  it("1 — never held: witness, no book", () => {
    const v = run(history([]));
    expect(v.status).toBe("witness");
    expect(v.book).toBeNull();
    expect(v.line).toBe("Now you know. There are no bystanders.");
  });

  it("2 — below the threshold and never faithful: sympathizer", () => {
    const v = run(history([["buy", 12_000, 5]]));
    expect(v.status).toBe("sympathizer");
    expect(v.book).toBeNull();
  });

  it("2 — a small holder who sold is still only a sympathizer", () => {
    const v = run(history([["buy", 15_000, 9], ["sell", 10_000, 1]]));
    expect(v.status).toBe("sympathizer");
  });

  it("3 — traitor who bought back and held 7 days is forgiven, with a scar", () => {
    const v = run(history([["buy", 800_000, 40], ["sell", 800_000, 30], ["buy", 300_000, 20]]));
    expect(v.status).toBe("forgiven");
    expect(v.book).toBe("faithful");
    expect(v.scar).toBe(true);
  });

  it("3 — forgiveness waits for the third seal", () => {
    const v = run(history([["buy", 800_000, 40], ["sell", 800_000, 30], ["buy", 300_000, 20]]), 2);
    expect(v.status).toBe("traitor");
    expect(v.redemptionDaysLeft).toBe(0);
  });

  it("3 — repenting traitor sees the days left", () => {
    const v = run(history([["buy", 800_000, 40], ["sell", 800_000, 30], ["buy", 300_000, 3]]));
    expect(v.status).toBe("traitor");
    expect(v.redemptionDaysLeft).toBe(4);
  });

  it("3 — selling during repentance restarts the clock", () => {
    const v = run(
      history([
        ["buy", 800_000, 40],
        ["sell", 800_000, 30],
        ["buy", 300_000, 20],
        ["sell", 10_000, 15],
      ]),
    );
    expect(v.status).toBe("traitor");
    expect(v.redemptionDaysLeft).toBeNull();
  });

  it("4 — falling below the threshold by selling is betrayal", () => {
    const v = run(history([["buy", 1_500_000, 30], ["sell", 1_450_000, 6]]));
    expect(v.status).toBe("traitor");
    expect(v.book).toBe("traitors");
    expect(v.betrayalSignature).toBe("sig-1");
    expect(v.betrayalAmount).toBe(1_450_000);
    expect(v.line).toBe("Noted. It will not forget.");
  });

  it("4 — selling half of the peak is betrayal even above the threshold", () => {
    const v = run(history([["buy", 10_000_000, 30], ["sell", 6_000_000, 10]]));
    expect(v.status).toBe("traitor");
  });

  it("4 — small sells add up to half of the peak", () => {
    const v = run(
      history([
        ["buy", 2_000_000, 30],
        ["sell", 400_000, 20],
        ["sell", 400_000, 15],
        ["sell", 300_000, 10],
      ]),
    );
    expect(v.status).toBe("traitor");
  });

  it("4 — a forgiven wallet can betray again", () => {
    const v = run(
      history([
        ["buy", 800_000, 60],
        ["sell", 800_000, 50],
        ["buy", 500_000, 40],
        ["sell", 450_000, 5],
      ]),
    );
    expect(v.status).toBe("traitor");
    expect(v.betrayalSignature).toBe("sig-3");
  });

  it("transfers are never betrayal", () => {
    const v = run(history([["buy", 1_000_000, 30], ["out", 990_000, 5]]));
    expect(v.status).toBe("sympathizer");
    expect(v.traitorAt).toBeNull();
  });

  it("5 — a recent small sell writes the wallet in pencil", () => {
    const v = run(history([["buy", 900_000, 25], ["sell", 200_000, 2]]));
    expect(v.status).toBe("doubter");
    expect(v.book).toBe("faithful");
    expect(v.title.startsWith("Doubting")).toBe(true);
  });

  it("5 — after seven quiet days the pencil turns to ink", () => {
    const v = run(history([["buy", 900_000, 25], ["sell", 200_000, 8]]));
    expect(v.status).toBe("faithful");
  });

  it("6 — rank by balance, eleven steps from 20,000", () => {
    expect(run(history([["buy", 20_000, 3]])).rank).toBe("pet");
    expect(run(history([["buy", 60_000, 3]])).rank).toBe("acolyte");
    expect(run(history([["buy", 150_000, 3]])).rank).toBe("scribe");
    expect(run(history([["buy", 350_000, 3]])).rank).toBe("lamplighter");
    expect(run(history([["buy", 700_000, 3]])).rank).toBe("keeper");
    expect(run(history([["buy", 1_200_000, 3]])).rank).toBe("warden");
    expect(run(history([["buy", 2_400_000, 3]])).rank).toBe("herald");
    expect(run(history([["buy", 6_200_000, 3]])).rank).toBe("priest");
    expect(run(history([["buy", 14_000_000, 3]])).rank).toBe("archon");
    expect(run(history([["buy", 25_000_000, 3]])).rank).toBe("apostle");
    expect(run(history([["buy", 60_000_000, 3]])).rank).toBe("hand");
  });

  it("6 — pets get a species from the address, always the same one", () => {
    const a = run(history([["buy", 30_000, 3]]));
    const b = run(history([["buy", 30_000, 3]]));
    expect(a.title).toMatch(/ of the Basilisk$/);
    expect(a.title).toBe(b.title);
  });
});

describe("tenure", () => {
  it("lifts one step per 30 days without selling", () => {
    expect(run(history([["buy", 30_000, 31]])).rank).toBe("acolyte");
    expect(run(history([["buy", 30_000, 61]])).rank).toBe("scribe");
    expect(run(history([["buy", 30_000, 91]])).rank).toBe("lamplighter");
  });

  it("lifts three ranks at most", () => {
    expect(run(history([["buy", 30_000, 400]])).rank).toBe("lamplighter");
    expect(applyTenure("pet", 1000)).toBe("lamplighter");
  });

  it("never lifts above priest", () => {
    expect(run(history([["buy", 2_400_000, 400]])).rank).toBe("priest");
    expect(applyTenure("herald", 1000)).toBe("priest");
  });

  it("the ranks above priest come from balance only", () => {
    expect(applyTenure("archon", 1000)).toBe("archon");
    expect(rankByBalance(9_999_999)).toBe("priest");
    expect(rankByBalance(10_000_000)).toBe("archon");
    expect(rankByBalance(50_000_000)).toBe("hand");
    expect(rankByBalance(19_999)).toBeNull();
  });

  it("a sale restarts the tenure clock", () => {
    const v = run(history([["buy", 900_000, 90], ["sell", 100_000, 10]]));
    expect(v.status).toBe("faithful");
    expect(v.tenureDays).toBe(10);
    expect(v.rank).toBe("keeper");
  });
});

describe("demo mode", () => {
  it("gives every address a stable scenario", () => {
    expect(demoScenario(ADDRESS)).toBe(demoScenario(ADDRESS));
    const v = judge(demoHistory(ADDRESS, NOW), { now: NOW, sealsBroken: 3, demo: true });
    expect(v.demo).toBe(true);
  });
});
