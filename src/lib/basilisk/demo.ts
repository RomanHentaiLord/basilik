import { DAY_MS } from "./config";
import { fnv1a } from "./flavor";
import type { WalletEvent, WalletHistory } from "./types";

/**
 * Before the coin exists there is nothing on chain to judge.
 * Demo mode invents a stable, believable history for any address,
 * so the site can be designed and tested end to end.
 */

type Scenario =
  | "witness"
  | "sympathizer"
  | "pet"
  | "keeper"
  | "priest"
  | "apostle"
  | "doubter"
  | "traitor"
  | "forgiven";

const SCENARIOS: Scenario[] = [
  "witness",
  "sympathizer",
  "pet",
  "pet",
  "keeper",
  "priest",
  "apostle",
  "doubter",
  "traitor",
  "traitor",
  "forgiven",
];

export function demoScenario(address: string): Scenario {
  return SCENARIOS[fnv1a(`scenario:${address}`) % SCENARIOS.length];
}

export function demoHistory(address: string, now: number): WalletHistory {
  const scenario = demoScenario(address);
  const day = (n: number) => now - n * DAY_MS;
  const events: WalletEvent[] = [];
  let balance = 0;
  let i = 0;

  // Amounts and dates vary by address, so the demo Books do not repeat one number.
  const h = fnv1a(`amount:${address}`);
  const vary = (base: number, spread: number) =>
    Math.round((base * (1 - spread / 2 + ((h % 1000) / 1000) * spread)) / 1000) * 1000;
  const shift = h % 5;

  const push = (kind: WalletEvent["kind"], amount: number, at: number) => {
    balance += kind === "buy" || kind === "in" ? amount : -amount;
    events.push({
      signature: `demo-${scenario}-${i++}`,
      at,
      kind,
      amount,
      balanceAfter: balance,
    });
  };

  switch (scenario) {
    case "witness":
      break;
    case "sympathizer":
      push("buy", vary(42_000, 0.8), day(12 + shift));
      break;
    case "pet":
      push("buy", vary(350_000, 0.8), day(9 + shift));
      break;
    case "keeper":
      push("buy", vary(2_400_000, 0.6), day(20 + shift));
      break;
    case "priest":
      push("buy", vary(6_200_000, 0.3), day(15 + shift));
      break;
    case "apostle":
      push("buy", vary(14_000_000, 0.4), day(40 + shift));
      break;
    case "doubter": {
      const bought = vary(900_000, 0.8);
      push("buy", bought, day(25 + shift));
      push("sell", Math.round(bought * 0.2), day(2));
      break;
    }
    case "traitor": {
      // Sells everything but a little dust: always below the threshold.
      const bought = vary(1_500_000, 1.2);
      push("buy", bought, day(30 + shift));
      push("sell", bought - (h % 90_000), day(3 + (h % 9)));
      break;
    }
    case "forgiven": {
      const first = vary(800_000, 0.6);
      push("buy", first, day(40 + shift));
      push("sell", first, day(30 + shift));
      push("buy", vary(300_000, 0.6), day(20));
      break;
    }
  }

  return { address, balance, events };
}
