import { describe, expect, it } from "vitest";
import { DAY_MS } from "./config";
import { daysUntilInk, nextRankStep, tokensToEnter } from "./progress";

describe("nextRankStep", () => {
  it("counts tokens and tenure days to the next rank", () => {
    expect(nextRankStep({ status: "faithful", rank: "pet", balance: 350_000, tenureDays: 9 })).toEqual({
      rank: "keeper",
      more: 650_000,
      days: 21,
    });
  });

  it("offers no tenure route to Apostle", () => {
    expect(nextRankStep({ status: "faithful", rank: "priest", balance: 6_000_000, tenureDays: 40 })).toEqual({
      rank: "apostle",
      more: 4_000_000,
      days: null,
    });
  });

  it("offers no tenure route while written in pencil", () => {
    expect(nextRankStep({ status: "doubter", rank: "pet", balance: 700_000, tenureDays: 0 })?.days).toBeNull();
  });

  it("returns null at the top of the Order and outside it", () => {
    expect(nextRankStep({ status: "faithful", rank: "apostle", balance: 20_000_000, tenureDays: 3 })).toBeNull();
    expect(nextRankStep({ status: "witness", rank: null, balance: 0, tenureDays: 0 })).toBeNull();
  });
});

describe("daysUntilInk", () => {
  it("counts down the seven days after the last sale", () => {
    const now = Date.UTC(2026, 10, 22);
    expect(daysUntilInk(now - 2 * DAY_MS, now)).toBe(5);
    expect(daysUntilInk(now - 9 * DAY_MS, now)).toBe(0);
    expect(daysUntilInk(null, now)).toBeNull();
  });
});

describe("tokensToEnter", () => {
  it("is the gap to 100,000", () => {
    expect(tokensToEnter(42_000)).toBe(58_000);
    expect(tokensToEnter(250_000)).toBe(0);
  });
});
