import { describe, expect, it } from "vitest";
import { DAY_MS, HOUR_MS } from "./config";
import { nextRankStep, tokensToEnter, untilInk } from "./progress";

describe("nextRankStep", () => {
  it("counts tokens and the time to the next tenure mark", () => {
    expect(nextRankStep({ status: "faithful", rank: "pet", balance: 30_000, tenureMs: 20 * 60_000 })).toEqual({
      rank: "acolyte",
      more: 20_000,
      wait: 40 * 60_000,
    });
    // Past 3 hours the next mark is a day.
    expect(nextRankStep({ status: "faithful", rank: "lamplighter", balance: 30_000, tenureMs: 5 * HOUR_MS })?.wait).toBe(
      19 * HOUR_MS,
    );
  });

  it("offers no tenure route above Priest", () => {
    expect(nextRankStep({ status: "faithful", rank: "priest", balance: 6_000_000, tenureMs: 2 * DAY_MS })).toEqual({
      rank: "archon",
      more: 4_000_000,
      wait: null,
    });
  });

  it("offers no tenure route after the last mark", () => {
    // 30,000 tokens is a Pet by balance; five tenure marks made it a Warden.
    expect(nextRankStep({ status: "faithful", rank: "warden", balance: 30_000, tenureMs: 9 * DAY_MS })?.wait).toBeNull();
  });

  it("offers no tenure route while written in pencil", () => {
    expect(nextRankStep({ status: "doubter", rank: "keeper", balance: 700_000, tenureMs: 0 })?.wait).toBeNull();
  });

  it("returns null at the top of the Order and outside it", () => {
    expect(nextRankStep({ status: "faithful", rank: "hand", balance: 60_000_000, tenureMs: 3 * DAY_MS })).toBeNull();
    expect(nextRankStep({ status: "witness", rank: null, balance: 0, tenureMs: 0 })).toBeNull();
  });
});

describe("untilInk", () => {
  it("counts down the hour after the last sale", () => {
    const now = Date.UTC(2026, 10, 22);
    expect(untilInk(now - 20 * 60_000, now)).toBe(40 * 60_000);
    expect(untilInk(now - 2 * HOUR_MS, now)).toBe(0);
    expect(untilInk(null, now)).toBeNull();
  });
});

describe("tokensToEnter", () => {
  it("is the gap to 20,000", () => {
    expect(tokensToEnter(12_000)).toBe(8_000);
    expect(tokensToEnter(250_000)).toBe(0);
  });
});
