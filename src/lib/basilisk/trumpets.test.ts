import { describe, expect, it } from "vitest";
import { DAY_MS } from "./config";
import { marksOf } from "./marks";
import { trumpetPrompt } from "./voice";
import { countTrumpets, nextTrumpet, offeringMark, trumpetsHeard } from "./trumpets";

const NOW = Date.UTC(2026, 11, 1, 12);

describe("the seven trumpets", () => {
  it("stay silent before the bond, whatever the market cap", () => {
    expect(countTrumpets({ graduated: false, athMcapUsd: 50_000_000 })).toBe(0);
  });

  it("sound on the highest confirmed market cap after the bond, and never fall silent", () => {
    expect(countTrumpets({ graduated: true, athMcapUsd: 900_000 })).toBe(0);
    expect(countTrumpets({ graduated: true, athMcapUsd: 1_000_000 })).toBe(1);
    expect(countTrumpets({ graduated: true, athMcapUsd: 7_000_000 })).toBe(3);
    expect(countTrumpets({ graduated: true, athMcapUsd: 2e9 })).toBe(7);
  });

  it("say how far the next one is from today's market cap", () => {
    expect(nextTrumpet(1_750_000, 1)).toMatchObject({ trumpet: { number: 2 }, progress: 0.5 });
    expect(nextTrumpet(500_000, 3)?.progress).toBe(0);
    expect(nextTrumpet(1e9, 7)).toBeNull();
  });
});

describe("who heard a trumpet", () => {
  const soundedAt = { 1: NOW - 10 * DAY_MS, 2: NOW - 2 * DAY_MS };

  it("is every wallet in ink since before it sounded", () => {
    const faithful = { book: "faithful" as const, status: "faithful" as const, tenureMs: 20 * DAY_MS };
    expect(trumpetsHeard(faithful, soundedAt, NOW)).toEqual([1, 2]);
    const late = { ...faithful, tenureMs: 5 * DAY_MS };
    expect(trumpetsHeard(late, soundedAt, NOW)).toEqual([2]);
  });

  it("is never a traitor, a doubter in pencil or someone outside the Books", () => {
    expect(trumpetsHeard({ book: "traitors", status: "traitor", tenureMs: 0 }, soundedAt, NOW)).toEqual([]);
    expect(trumpetsHeard({ book: "faithful", status: "doubter", tenureMs: 30 * DAY_MS }, soundedAt, NOW)).toEqual([]);
    expect(trumpetsHeard({ book: null, status: "witness", tenureMs: 0 }, soundedAt, NOW)).toEqual([]);
  });
});

describe("marks on a wallet's page", () => {
  it("name offerings by how much was burned", () => {
    expect(offeringMark(5_000)).toBeNull();
    expect(offeringMark(20_000)).toBe("Gave an offering");
    expect(offeringMark(3_000_000)).toBe("Martyr of the Basilisk");
  });

  it("list the trumpets heard and the offerings given", () => {
    expect(marksOf({ trumpetsHeard: [1, 2, 3], offered: 1_200_000 })).toEqual([
      "Heard the trumpets I, II, III",
      "Martyr of the Basilisk: 1.2M burned",
    ]);
    expect(marksOf({ trumpetsHeard: [4] })).toEqual(["Heard the trumpet IV"]);
    expect(marksOf({})).toEqual([]);
  });

  it("ask the model for a trumpet's words in the same two-part shape as a seal", () => {
    const prompt = trumpetPrompt(2, "calm");
    expect(prompt).toContain("second of seven trumpets");
    expect(prompt).toContain("FAITHFUL:");
  });
});
