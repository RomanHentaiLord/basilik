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
      push("buy", 42_000, day(12));
      break;
    case "pet":
      push("buy", 350_000, day(9));
      break;
    case "keeper":
      push("buy", 2_400_000, day(20));
      break;
    case "priest":
      push("buy", 6_200_000, day(15));
      break;
    case "apostle":
      push("buy", 14_000_000, day(40));
      break;
    case "doubter":
      push("buy", 900_000, day(25));
      push("sell", 200_000, day(2));
      break;
    case "traitor":
      push("buy", 1_500_000, day(30));
      push("sell", 1_450_000, day(6));
      break;
    case "forgiven":
      push("buy", 800_000, day(40));
      push("sell", 800_000, day(30));
      push("buy", 300_000, day(20));
      break;
  }

  return { address, balance, events };
}
