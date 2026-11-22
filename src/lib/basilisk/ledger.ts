import {
  DAY_MS,
  FAITHFUL_THRESHOLD,
  REDEMPTION_DAYS,
  TRAITOR_SELL_SHARE,
} from "./config";
import type { WalletEvent } from "./types";

/**
 * Everything the judge needs to know about a wallet's past,
 * computed by replaying its events from oldest to newest.
 */
export interface Ledger {
  everHeld: boolean;
  everFaithful: boolean;
  /** The first time the wallet reached the threshold. Orders the Book of the Faithful. */
  firstFaithfulAt: number | null;
  /** Highest balance since the last betrayal (or since first becoming faithful). */
  peak: number;
  /** Start of the current uninterrupted stretch at or above the threshold. */
  aboveSince: number | null;
  lastSellAt: number | null;
  /** Time of the most recent betrayal; null if the wallet never betrayed. */
  traitorAt: number | null;
  betrayalSignature: string | null;
  betrayalAmount: number | null;
  /** When the traitor had bought back the threshold and held it; null while not repenting. */
  redemptionStart: number | null;
}

function isForgivenAt(ledger: Ledger, at: number): boolean {
  return (
    ledger.traitorAt !== null &&
    ledger.redemptionStart !== null &&
    at - ledger.redemptionStart >= REDEMPTION_DAYS * DAY_MS
  );
}

/**
 * Replay a wallet's events.
 *
 * Rules (see the concept doc, "Роли и книги"):
 * - A wallet becomes faithful the first time it holds the threshold.
 * - A SALE by a faithful wallet is betrayal when it drops the balance below the threshold
 *   or when sales since the peak reach half of that peak. Transfers never count.
 * - A traitor repents by BUYING back at least the threshold; the clock starts when
 *   the bought amount and the balance both reach it, and any sale resets it.
 */
export function replay(events: readonly WalletEvent[]): Ledger {
  const ledger: Ledger = {
    everHeld: false,
    everFaithful: false,
    firstFaithfulAt: null,
    peak: 0,
    aboveSince: null,
    lastSellAt: null,
    traitorAt: null,
    betrayalSignature: null,
    betrayalAmount: null,
    redemptionStart: null,
  };

  let soldSincePeak = 0;
  let boughtSinceBetrayal = 0;

  const sorted = [...events].sort((a, b) => a.at - b.at);

  for (const event of sorted) {
    const balance = event.balanceAfter;
    const forgivenBefore = isForgivenAt(ledger, event.at);

    if (balance > 0) ledger.everHeld = true;

    // Uninterrupted stretch at or above the threshold.
    if (balance >= FAITHFUL_THRESHOLD) {
      if (ledger.aboveSince === null) ledger.aboveSince = event.at;
      if (ledger.firstFaithfulAt === null) ledger.firstFaithfulAt = event.at;
      ledger.everFaithful = true;
    } else {
      ledger.aboveSince = null;
    }

    if (!ledger.everFaithful) {
      if (event.kind === "sell") ledger.lastSellAt = event.at;
      continue;
    }

    if (balance > ledger.peak) {
      ledger.peak = balance;
      soldSincePeak = 0;
    }

    if (event.kind === "sell") {
      ledger.lastSellAt = event.at;
      soldSincePeak += event.amount;

      const betrayed =
        balance < FAITHFUL_THRESHOLD ||
        soldSincePeak >= TRAITOR_SELL_SHARE * ledger.peak;

      const repenting = ledger.traitorAt !== null && !forgivenBefore;

      if (betrayed && !repenting) {
        // Fresh betrayal (by a faithful or a forgiven wallet).
        ledger.traitorAt = event.at;
        ledger.betrayalSignature = event.signature;
        ledger.betrayalAmount = event.amount;
        ledger.redemptionStart = null;
        ledger.peak = balance;
        soldSincePeak = 0;
        boughtSinceBetrayal = 0;
      } else if (repenting) {
        // Selling while repenting: still a traitor, the redemption starts over.
        ledger.redemptionStart = null;
        boughtSinceBetrayal = 0;
      }
      continue;
    }

    if (ledger.traitorAt !== null && !forgivenBefore) {
      if (event.kind === "buy") boughtSinceBetrayal += event.amount;

      if (balance < FAITHFUL_THRESHOLD) {
        ledger.redemptionStart = null;
      } else if (
        ledger.redemptionStart === null &&
        boughtSinceBetrayal >= FAITHFUL_THRESHOLD
      ) {
        ledger.redemptionStart = event.at;
      }
    }
  }

  return ledger;
}

export { isForgivenAt };
