import { describe, expect, it } from "vitest";
import { countBrokenSeals, nextSeal } from "./seals";

describe("seals", () => {
  it("none broken at launch", () => {
    expect(countBrokenSeals({ mcapUsd: 5_000, graduated: false })).toBe(0);
  });

  it("the second seal needs graduation, not just market cap", () => {
    expect(countBrokenSeals({ mcapUsd: 60_000, graduated: false })).toBe(1);
    expect(countBrokenSeals({ mcapUsd: 60_000, graduated: true })).toBe(2);
  });

  it("seals break in order and never close again", () => {
    expect(countBrokenSeals({ mcapUsd: 312_000, graduated: true })).toBe(3);
    expect(countBrokenSeals({ mcapUsd: 90_000, graduated: true, athMcapUsd: 600_000 })).toBe(4);
    expect(countBrokenSeals({ mcapUsd: 12_000_000, graduated: true })).toBe(7);
  });

  it("progress to the next seal", () => {
    const next = nextSeal({ mcapUsd: 375_000, graduated: true });
    expect(next?.seal.roman).toBe("IV");
    expect(next?.progress).toBeCloseTo(0.5);
    expect(nextSeal({ mcapUsd: 20_000_000, graduated: true })).toBeNull();
  });
});
