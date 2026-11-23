import { describe, expect, it } from "vitest";
import { DAY_MS, HOUR_MS } from "./config";
import { demoHistory, demoScenario } from "./demo";
import { applyTenure, judge, rankByBalance } from "./judge";
import type { WalletEvent, WalletHistory } from "./types";

const NOW = Date.UTC(2026, 10, 21, 12, 0, 0);
const ADDRESS = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
const daysAgo = (n: number) => NOW - n * DAY_MS;
const HOUR_IN_DAYS = HOUR_MS / DAY_MS;
/** Ten minutes ago: too soon for any tenure mark, so the rank comes from the balance alone. */
const JUST_NOW = HOUR_IN_DAYS / 6;

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

  it("3 — traitor who bought back and held a day is forgiven, with a scar", () => {
    const v = run(history([["buy", 800_000, 40], ["sell", 800_000, 30], ["buy", 300_000, 20]]));
    expect(v.status).toBe("forgiven");
    expect(v.book).toBe("faithful");
    expect(v.scar).toBe(true);
  });

  it("3 — forgiveness waits for the third seal", () => {
    const v = run(history([["buy", 800_000, 40], ["sell", 800_000, 30], ["buy", 300_000, 20]]), 2);
    expect(v.status).toBe("traitor");
    expect(v.redemptionMsLeft).toBe(0);
  });

  it("3 — repenting traitor sees the time left", () => {
    const v = run(history([["buy", 800_000, 40], ["sell", 800_000, 30], ["buy", 300_000, 6 * HOUR_IN_DAYS]]));
    expect(v.status).toBe("traitor");
    expect(v.redemptionMsLeft).toBe(18 * HOUR_MS);
  });

  it("3 — selling during repentance restarts the clock", () => {
    const v = run(
      history([
        ["buy", 800_000, 40],
        ["sell", 800_000, 30],
        ["buy", 300_000, 10 * HOUR_IN_DAYS],
        ["sell", 10_000, 5 * HOUR_IN_DAYS],
      ]),
    );
    expect(v.status).toBe("traitor");
    expect(v.redemptionMsLeft).toBeNull();
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

  it("5 — a small sell within the hour writes the wallet in pencil", () => {
    const v = run(history([["buy", 900_000, 25], ["sell", 200_000, 0.5 * HOUR_IN_DAYS]]));
    expect(v.status).toBe("doubter");
    expect(v.book).toBe("faithful");
    expect(v.title.startsWith("Doubting")).toBe(true);
  });

  it("5 — after a quiet hour the pencil turns to ink", () => {
    const v = run(history([["buy", 900_000, 25], ["sell", 200_000, 2 * HOUR_IN_DAYS]]));
    expect(v.status).toBe("faithful");
  });

  it("6 — rank by balance, eleven steps from 20,000", () => {
    expect(run(history([["buy", 20_000, JUST_NOW]])).rank).toBe("pet");
    expect(run(history([["buy", 60_000, JUST_NOW]])).rank).toBe("acolyte");
    expect(run(history([["buy", 150_000, JUST_NOW]])).rank).toBe("scribe");
    expect(run(history([["buy", 350_000, JUST_NOW]])).rank).toBe("lamplighter");
    expect(run(history([["buy", 700_000, JUST_NOW]])).rank).toBe("keeper");
    expect(run(history([["buy", 1_200_000, JUST_NOW]])).rank).toBe("warden");
    expect(run(history([["buy", 2_400_000, JUST_NOW]])).rank).toBe("herald");
    expect(run(history([["buy", 6_200_000, JUST_NOW]])).rank).toBe("priest");
    expect(run(history([["buy", 14_000_000, JUST_NOW]])).rank).toBe("archon");
    expect(run(history([["buy", 25_000_000, JUST_NOW]])).rank).toBe("apostle");
    expect(run(history([["buy", 60_000_000, JUST_NOW]])).rank).toBe("hand");
  });

  it("6 — pets get a species from the address, always the same one", () => {
    const a = run(history([["buy", 30_000, JUST_NOW]]));
    const b = run(history([["buy", 30_000, JUST_NOW]]));
    expect(a.title).toMatch(/ of the Basilisk$/);
    expect(a.title).toBe(b.title);
  });
});

describe("tenure", () => {
  it("lifts one step at 1 hour, 2 hours, 3 hours, 1 day and 7 days without selling", () => {
    const heldFor = (days: number) => run(history([["buy", 30_000, days]])).rank;
    expect(heldFor(0.5 * HOUR_IN_DAYS)).toBe("pet");
    expect(heldFor(1 * HOUR_IN_DAYS)).toBe("acolyte");
    expect(heldFor(2 * HOUR_IN_DAYS)).toBe("scribe");
    expect(heldFor(3 * HOUR_IN_DAYS)).toBe("lamplighter");
    expect(heldFor(1)).toBe("keeper");
    expect(heldFor(6.9)).toBe("keeper");
    expect(heldFor(7)).toBe("warden");
  });

  it("lifts five ranks at most", () => {
    expect(run(history([["buy", 30_000, 400]])).rank).toBe("warden");
    expect(applyTenure("pet", 400 * DAY_MS)).toBe("warden");
  });

  it("never lifts above priest", () => {
    expect(run(history([["buy", 2_400_000, 400]])).rank).toBe("priest");
    expect(applyTenure("herald", 400 * DAY_MS)).toBe("priest");
  });

  it("the ranks above priest come from balance only", () => {
    expect(applyTenure("archon", 400 * DAY_MS)).toBe("archon");
    expect(rankByBalance(9_999_999)).toBe("priest");
    expect(rankByBalance(10_000_000)).toBe("archon");
    expect(rankByBalance(50_000_000)).toBe("hand");
    expect(rankByBalance(19_999)).toBeNull();
  });

  it("a sale restarts the tenure clock", () => {
    const v = run(history([["buy", 900_000, 90], ["sell", 100_000, 5 * HOUR_IN_DAYS]]));
    expect(v.status).toBe("faithful");
    expect(v.tenureMs).toBe(5 * HOUR_MS);
    // 800,000 is a Keeper by balance; three marks (1, 2 and 3 hours) lift it to Priest, the cap.
    expect(v.rank).toBe("priest");
  });

  it("a sale within the hour writes the wallet in pencil", () => {
    const v = run(history([["buy", 900_000, 90], ["sell", 100_000, 0.5 * HOUR_IN_DAYS]]));
    expect(v.status).toBe("doubter");
  });
});

describe("demo mode", () => {
  it("gives every address a stable scenario", () => {
    expect(demoScenario(ADDRESS)).toBe(demoScenario(ADDRESS));
    const v = judge(demoHistory(ADDRESS, NOW), { now: NOW, sealsBroken: 3, demo: true });
    expect(v.demo).toBe(true);
  });
});
