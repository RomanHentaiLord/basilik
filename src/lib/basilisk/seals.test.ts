import { describe, expect, it } from "vitest";
import { countBrokenSeals, nextSeal } from "./seals";

const at = (curve: number, curveHigh?: number) => ({ mcapUsd: 0, graduated: false, curve, curveHigh });

describe("seals", () => {
  it("none broken at launch", () => {
    expect(countBrokenSeals(at(0.03))).toBe(0);
  });

  it("six seals break on the bonding curve, before any bond", () => {
    expect(countBrokenSeals(at(0.1))).toBe(1);
    expect(countBrokenSeals(at(0.3))).toBe(2);
    expect(countBrokenSeals(at(0.47))).toBe(3);
    expect(countBrokenSeals(at(0.99))).toBe(6);
  });

  it("the seventh seal is the bond itself", () => {
    expect(countBrokenSeals({ mcapUsd: 0, graduated: true })).toBe(7);
  });

  it("seals never close: the highest point of the curve counts", () => {
    expect(countBrokenSeals(at(0.12, 0.58))).toBe(4);
  });

  it("market cap alone breaks nothing", () => {
    expect(countBrokenSeals({ mcapUsd: 14_000_000_000, graduated: false })).toBe(0);
  });

  it("progress to the next seal", () => {
    const next = nextSeal(at(0.475));
    expect(next?.seal.roman).toBe("IV");
    expect(next?.progress).toBeCloseTo(0.5);
    expect(nextSeal(at(0.9))?.seal.roman).toBe("VII");
    expect(nextSeal({ mcapUsd: 0, graduated: true })).toBeNull();
  });
});
