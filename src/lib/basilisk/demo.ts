import { DAY_MS, HOUR_MS, MINUTE_MS, RANKS, RANK_FLOORS, type Rank } from "./config";
import { fnv1a } from "./flavor";
import type { WalletEvent, WalletHistory } from "./types";

/**
 * Before the coin exists there is nothing on chain to judge.
 * Demo mode invents a stable, believable history for any address,
 * so the site can be designed and tested end to end.
 */

type Scenario = "witness" | "sympathizer" | "doubter" | "traitor" | "forgiven" | Rank;

/** More small holders than whales, like a real coin. */
const SCENARIOS: Scenario[] = [
  "witness",
  "sympathizer",
  "sympathizer",
  "pet",
  "pet",
  "pet",
  "acolyte",
  "acolyte",
  "scribe",
  "scribe",
  "lamplighter",
  "lamplighter",
  "keeper",
  "warden",
  "herald",
  "priest",
  "archon",
  "apostle",
  "hand",
  "doubter",
  "doubter",
  "traitor",
  "traitor",
  "traitor",
  "forgiven",
];

export function demoScenario(address: string): Scenario {
  return SCENARIOS[fnv1a(`scenario:${address}`) % SCENARIOS.length];
}

function isRank(scenario: Scenario): scenario is Rank {
  return (RANKS as readonly string[]).includes(scenario);
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
  // Holding times spread over the tenure marks (1 h, 2 h, 3 h, 1 day, 7 days), so some
  // holders are lifted by tenure and some are not yet.
  const HELD = [10 * MINUTE_MS, 40 * MINUTE_MS, 70 * MINUTE_MS, 150 * MINUTE_MS, 5 * HOUR_MS, 30 * HOUR_MS, 8 * DAY_MS];
  const heldMs = HELD[(h >>> 10) % HELD.length];

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

  if (isRank(scenario)) {
    // 1.5x the floor, ±25%: always inside the rank's band on the 1-2-5 ladder.
    push("buy", vary(RANK_FLOORS[scenario] * 1.5, 0.5), now - heldMs);
    return { address, balance, events };
  }

  switch (scenario) {
    case "witness":
      break;
    case "sympathizer":
      push("buy", vary(9_000, 0.8), day(12 + shift));
      break;
    case "doubter": {
      const bought = vary(900_000, 0.8);
      push("buy", bought, day(25 + shift));
      // Within the last hour: still in pencil.
      push("sell", Math.round(bought * 0.2), now - (15 + shift * 5) * MINUTE_MS);
      break;
    }
    case "traitor": {
      // Sells everything but a little dust: always more than half of the peak.
      const bought = vary(1_500_000, 1.2);
      push("buy", bought, day(30 + shift));
      push("sell", bought - (h % 15_000), day(3 + (h % 9)));
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
