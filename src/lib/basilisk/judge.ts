import {
  DOUBT_WINDOW_MS,
  FAITHFUL_THRESHOLD,
  RANKS,
  RANK_FLOORS,
  REDEMPTION_MS,
  REPENTANCE_SEAL,
  TENURE_RANK_CAP,
  TENURE_STEPS_MS,
  type Rank,
} from "./config";
import {
  LINES,
  PUNISHMENT_FATES,
  PUNISHMENT_TITLES,
  RANK_FATES,
  RANK_TITLES,
  SPECIES_NAMES,
  STATUS_FATES,
} from "./copy";
import { PET_SPECIES, PUNISHMENTS, pick } from "./flavor";
import { isForgivenAt, replay } from "./ledger";
import type { Verdict, WalletHistory } from "./types";

export interface JudgeOptions {
  /** Current time in ms. Injected so the judge stays a pure function. */
  now: number;
  /** How many seals are broken right now (0–7). */
  sealsBroken: number;
  demo?: boolean;
}

/** Rank by balance alone. */
export function rankByBalance(balance: number): Rank | null {
  let result: Rank | null = null;
  for (const rank of RANKS) {
    if (balance >= RANK_FLOORS[rank]) result = rank;
  }
  return result;
}

/** How many tenure marks (1 h, 2 h, 3 h, 1 day, 7 days) a holding stretch has passed. */
export function tenureSteps(tenureMs: number): number {
  return TENURE_STEPS_MS.filter((mark) => tenureMs >= mark).length;
}

/**
 * Each tenure mark lifts the rank by one, never above the tenure cap. Ranks above the cap
 * are earned by balance only, and tenure never lowers a rank.
 */
export function applyTenure(base: Rank, tenureMs: number): Rank {
  const baseIndex = RANKS.indexOf(base);
  const capIndex = RANKS.indexOf(TENURE_RANK_CAP);
  if (baseIndex >= capIndex) return base;
  return RANKS[Math.min(baseIndex + tenureSteps(tenureMs), capIndex)];
}

function faithfulTitle(rank: Rank, address: string): string {
  if (rank === "pet") {
    return `${SPECIES_NAMES[pick(address, "pet", PET_SPECIES)]} of the Basilisk`;
  }
  return RANK_TITLES[rank];
}

/**
 * The chain of checks from the concept doc ("Как кошелёк получает роль").
 * Checks run top to bottom; the first one that matches decides the role.
 */
export function judge(history: WalletHistory, options: JudgeOptions): Verdict {
  const { address, balance, events } = history;
  const { now, sealsBroken } = options;
  const ledger = replay(events);

  const sinceLastSell =
    ledger.lastSellAt === null ? Infinity : now - ledger.lastSellAt;
  const tenureStart = Math.max(ledger.aboveSince ?? now, ledger.lastSellAt ?? 0);
  const tenureMs = Math.max(0, now - tenureStart);
  const pet = pick(address, "pet", PET_SPECIES);
  const punishment = pick(address, "punishment", PUNISHMENTS);

  const base: Verdict = {
    address,
    status: "witness",
    book: null,
    rank: null,
    flavor: pet,
    title: "Witness",
    fate: STATUS_FATES.witness,
    line: LINES.witness,
    balance,
    peak: ledger.peak,
    tenureMs: balance >= FAITHFUL_THRESHOLD ? tenureMs : 0,
    lastSellAt: ledger.lastSellAt,
    traitorAt: ledger.traitorAt,
    betrayalSignature: ledger.betrayalSignature,
    betrayalAmount: ledger.betrayalAmount,
    scar: false,
    redemptionMsLeft: null,
    firstFaithfulAt: ledger.firstFaithfulAt,
    entryNumber: null,
    firstWitness: false,
    demo: options.demo ?? false,
  };

  // 1. Never held the token.
  if (!ledger.everHeld && balance <= 0) return base;

  // 2. Below the threshold and never faithful.
  if (balance < FAITHFUL_THRESHOLD && !ledger.everFaithful) {
    return {
      ...base,
      status: "sympathizer",
      title: "Sympathizer",
      fate: STATUS_FATES.sympathizer,
      line: LINES.sympathizer,
    };
  }

  // 3. A traitor who bought back the threshold and held it — only once repentance is open.
  const repentanceOpen = sealsBroken >= REPENTANCE_SEAL;
  const redeemed = isForgivenAt(ledger, now) && balance >= FAITHFUL_THRESHOLD;
  if (redeemed && repentanceOpen) {
    const rank = rankByBalance(balance) ?? "pet";
    return {
      ...base,
      status: "forgiven",
      book: "faithful",
      rank,
      title: `Forgiven ${faithfulTitle(rank, address)}`,
      fate: RANK_FATES[rank],
      line: LINES.forgiven,
      scar: true,
    };
  }

  // 4. Was faithful, then sold half of the peak or fell below the threshold.
  if (ledger.traitorAt !== null) {
    const redemptionMsLeft =
      ledger.redemptionStart === null ? null : Math.max(0, ledger.redemptionStart + REDEMPTION_MS - now);
    return {
      ...base,
      status: "traitor",
      book: "traitors",
      flavor: punishment,
      title: PUNISHMENT_TITLES[punishment],
      fate: PUNISHMENT_FATES[punishment],
      line: LINES.traitor,
      redemptionMsLeft,
    };
  }

  // Tokens moved away by transfer (never sold): not a traitor, just no longer in the book.
  if (balance < FAITHFUL_THRESHOLD) {
    return {
      ...base,
      status: "sympathizer",
      title: "Sympathizer",
      fate: STATUS_FATES.sympathizer,
      line: LINES.sympathizer,
    };
  }

  const baseRank = rankByBalance(balance) ?? "pet";

  // 5. Faithful, but sold something in the last few days.
  if (sinceLastSell < DOUBT_WINDOW_MS) {
    return {
      ...base,
      status: "doubter",
      book: "faithful",
      rank: baseRank,
      title: `Doubting ${faithfulTitle(baseRank, address)}`,
      fate: STATUS_FATES.doubter,
      line: LINES.doubter,
    };
  }

  // Otherwise: rank by balance, lifted by tenure.
  const rank = applyTenure(baseRank, tenureMs);
  return {
    ...base,
    status: "faithful",
    book: "faithful",
    rank,
    title: faithfulTitle(rank, address),
    fate: RANK_FATES[rank],
    line: LINES.faithful,
  };
}
