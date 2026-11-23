import { describe, expect, it } from "vitest";
import { DAY_MS, HOUR_MS } from "./config";
import { judge } from "./judge";
import { dayKey, moodOf, namedPunishment, personalProphecy, psalmFor, sealProphecy } from "./prophecy";
import type { Verdict, WalletEvent, WalletHistory } from "./types";
import { cleanSpeech, parseSealSpeech, personalPrompt } from "./voice";

const NOW = Date.UTC(2026, 10, 24, 12, 0, 0);
const ADDRESS = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
const OTHER = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";

function history(address: string, steps: [WalletEvent["kind"], number, number][]): WalletHistory {
  let balance = 0;
  const events = steps.map(([kind, amount, daysAgo], i) => {
    balance += kind === "buy" || kind === "in" ? amount : -amount;
    return { signature: `sig-${i}`, at: NOW - daysAgo * DAY_MS, kind, amount, balanceAfter: balance };
  });
  return { address, balance, events };
}

const verdictOf = (steps: [WalletEvent["kind"], number, number][], sealsBroken = 3, address = ADDRESS): Verdict =>
  judge(history(address, steps), { now: NOW, sealsBroken });

const faithful = verdictOf([["buy", 600_000, 3]]);
const traitor = verdictOf([["buy", 600_000, 5], ["sell", 1_200_000 / 2, 1]]);
const witness = verdictOf([]);

describe("personal prophecies", () => {
  it("open with the wallet and its title", () => {
    const text = personalProphecy(faithful, 2);
    expect(text.startsWith(`7xKX…gAsU, ${faithful.title}.`)).toBe(true);
  });

  it("are the same every time for the same wallet and seal", () => {
    expect(personalProphecy(faithful, 3)).toBe(personalProphecy(faithful, 3));
  });

  it("speak to traitors in red, and never call them faithful", () => {
    expect(traitor.status).toBe("traitor");
    const text = personalProphecy(traitor, 2);
    expect(text).toContain(traitor.title);
    expect(text).not.toMatch(/ink has dried|warmer corner/);
  });

  it("name the next seal", () => {
    const seen = new Set(
      Array.from({ length: 40 }, (_, i) => personalProphecy(verdictOf([["buy", 600_000, 3]], 3, `${OTHER.slice(0, -2)}${i}`), 3)),
    );
    expect([...seen].some((text) => text.includes("fourth seal"))).toBe(true);
  });

  it("grow a second, darker sentence from the sixth seal", () => {
    const five = personalProphecy(faithful, 5);
    const six = personalProphecy(faithful, 6);
    expect(six.split(". ").length).toBeGreaterThan(five.split(". ").length);
  });

  it("speak to those outside the Books without a title", () => {
    expect(personalProphecy(witness, 2).startsWith("7xKX…gAsU. ")).toBe(true);
  });

  it("never talk about prices", () => {
    for (let i = 0; i < 60; i++) {
      const address = `${OTHER.slice(0, -2)}${i}`;
      for (const v of [verdictOf([["buy", 600_000, 3]], 3, address), verdictOf([["buy", 600_000, 5], ["sell", 300_000, 1]], 4, address)]) {
        expect(cleanSpeech(personalProphecy(v, 6, "grim"), 400)).not.toBeNull();
      }
    }
  });
});

describe("named punishments", () => {
  it("put the traitor's address and the tokens sold into its own punishment", () => {
    const line = namedPunishment(traitor);
    expect(line).toContain("7xKX…gAsU");
    expect(line).toContain("600K");
  });
});

describe("seal prophecies and psalms", () => {
  it("get colder when the mood is grim", () => {
    expect(sealProphecy(4, "grim").traitors.length).toBeGreaterThan(sealProphecy(4).traitors.length);
  });

  it("give one psalm per day, the same for everyone", () => {
    expect(dayKey(NOW)).toBe("2026-11-24");
    expect(psalmFor("2026-11-24")).toBe(psalmFor("2026-11-24"));
    const week = new Set(Array.from({ length: 14 }, (_, i) => psalmFor(dayKey(NOW + i * DAY_MS))));
    expect(week.size).toBeGreaterThan(4);
  });

  it("turn grim when the curve falls back or traitors outnumber new Faithful", () => {
    expect(moodOf({ curve: 0.4, curveHigh: 0.45 })).toBe("calm");
    expect(moodOf({ curve: 0.3, curveHigh: 0.45 })).toBe("grim");
    expect(moodOf({ newFaithful: 3, newTraitors: 5 })).toBe("grim");
    expect(moodOf({ newFaithful: 5, newTraitors: 5 })).toBe("calm");
  });
});

describe("the model's words", () => {
  it("pass the filter when they are clean", () => {
    expect(cleanSpeech('  "At the fourth seal you will be given a warm fan."  ', 200)).toBe(
      "At the fourth seal you will be given a warm fan.",
    );
  });

  it("are rejected when they talk money, threaten, link or run long", () => {
    expect(cleanSpeech("Hold and the price will go to the moon.", 200)).toBeNull();
    expect(cleanSpeech("You will make 100x on this.", 200)).toBeNull();
    expect(cleanSpeech("Those who sold will die in the dark.", 200)).toBeNull();
    expect(cleanSpeech("Read more at https://example.org now please", 200)).toBeNull();
    expect(cleanSpeech("Follow @someone for the next prophecy", 200)).toBeNull();
    expect(cleanSpeech("It waits. ".repeat(40), 200)).toBeNull();
    expect(cleanSpeech("", 200)).toBeNull();
  });

  it("keep words that only look like banned ones", () => {
    expect(cleanSpeech("It will ask you again and again, forever.", 200)).not.toBeNull();
  });

  it("split a seal answer into its two parts", () => {
    expect(parseSealSpeech("FAITHFUL: You came early. It noticed.\nTRAITORS: You left early. It noticed that too.")).toEqual({
      faithful: "You came early. It noticed.",
      traitors: "You left early. It noticed that too.",
    });
    expect(parseSealSpeech("Something else entirely, with no parts at all.")).toBeNull();
  });

  it("are asked with the wallet's standing and the next seal", () => {
    const prompt = personalPrompt(faithful, 3, "calm");
    expect(prompt).toContain("7xKX…gAsU");
    expect(prompt).toContain("third seal");
    expect(prompt).toContain("fourth seal");
    expect(personalPrompt(traitor, 4, "grim")).toContain("Book of Traitors");
  });
});

describe("tenure in prophecies", () => {
  it("counts held time in the prompt", () => {
    const held = verdictOf([["buy", 600_000, 2 * HOUR_MS / DAY_MS]]);
    expect(personalPrompt(held, 2, "calm")).toMatch(/Held for 2 h/);
  });
});
