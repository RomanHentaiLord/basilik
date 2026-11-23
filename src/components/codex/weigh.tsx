"use client";

import { useId, useState, type CSSProperties } from "react";
import { FAITHFUL_THRESHOLD, RANKS, RANK_FLOORS, REDEMPTION_MS, type Rank } from "@/lib/basilisk/config";
import {
  BOOK,
  PUNISHMENT_FATES,
  PUNISHMENT_TITLES,
  RANK_FATES,
  RANK_TITLES,
  STATUS_FATES,
} from "@/lib/basilisk/copy";
import { PUNISHMENTS } from "@/lib/basilisk/flavor";
import { rankByBalance } from "@/lib/basilisk/judge";
import { formatDuration, formatTokens, formatTokensShort } from "@/lib/format";

type Deeds = keyof typeof BOOK.deeds;
type Tone = "ink" | "pencil" | "red" | "outside";

/**
 * The slider puts every rank floor at an even step (log-scaled in between), so all eleven ranks
 * get room: 2,000 at the left end, Pet at 20,000 … the Hand at 50 million, 80 million at the right.
 */
const STEPS = 1000;
const FIRST = 0.08;
const STRIDE = (0.94 - FIRST) / (RANKS.length - 1);
const MARKS = [
  { at: 0, tokens: 2_000 },
  ...RANKS.map((rank, i) => ({ at: FIRST + i * STRIDE, tokens: RANK_FLOORS[rank] })),
  { at: 1, tokens: 80_000_000 },
];

function tokensAt(position: number): number {
  if (position <= 0) return 0;
  const x = position / STEPS;
  const i = Math.max(0, MARKS.findIndex((mark) => mark.at >= x) - 1);
  const from = MARKS[i];
  const to = MARKS[i + 1] ?? MARKS[i];
  const share = to.at === from.at ? 0 : (x - from.at) / (to.at - from.at);
  const raw = 10 ** (Math.log10(from.tokens) + share * (Math.log10(to.tokens) - Math.log10(from.tokens)));
  const magnitude = 10 ** Math.max(0, Math.floor(Math.log10(raw)) - 1);
  return Math.round(raw / magnitude) * magnitude; // two significant digits
}

function positionOf(tokens: number): number {
  const i = Math.max(0, MARKS.findIndex((mark) => mark.tokens >= tokens) - 1);
  const from = MARKS[i];
  const to = MARKS[i + 1] ?? MARKS[i];
  const share =
    to.tokens === from.tokens ? 0 : (Math.log10(tokens) - Math.log10(from.tokens)) / (Math.log10(to.tokens) - Math.log10(from.tokens));
  return Math.round((from.at + share * (to.at - from.at)) * STEPS);
}

function rankTitle(rank: Rank): string {
  return rank === "pet" ? "Corgi of the Basilisk" : RANK_TITLES[rank];
}

interface Reckoning {
  title: string;
  fate: string;
  hint: string;
  tone: Tone;
}

/** What the Basilisk would write for a holding and a pattern of deeds. Uses the real rank rules. */
function reckon(tokens: number, deeds: Deeds): Reckoning {
  if (tokens <= 0) {
    return { title: "Witness", fate: STATUS_FATES.witness, hint: `Hold ${formatTokens(FAITHFUL_THRESHOLD)} to enter the Book.`, tone: "outside" };
  }
  const rank = rankByBalance(tokens);
  if (!rank) {
    return {
      title: "Sympathizer",
      fate: STATUS_FATES.sympathizer,
      hint: `${formatTokens(FAITHFUL_THRESHOLD - tokens)} more to enter the Book.`,
      tone: "outside",
    };
  }
  if (deeds === "half") {
    const punishment = PUNISHMENTS[Math.floor(Math.log10(tokens) * 3) % PUNISHMENTS.length];
    return {
      title: PUNISHMENT_TITLES[punishment],
      fate: PUNISHMENT_FATES[punishment],
      hint: `To be forgiven: buy back ${formatTokens(FAITHFUL_THRESHOLD)} and hold it for ${formatDuration(REDEMPTION_MS)}.`,
      tone: "red",
    };
  }
  if (deeds === "little") {
    return {
      title: `Doubting ${rankTitle(rank)}`,
      fate: STATUS_FATES.doubter,
      hint: "An hour without a sale and the pencil turns to ink.",
      tone: "pencil",
    };
  }
  const next = RANKS[RANKS.indexOf(rank) + 1];
  return {
    title: rankTitle(rank),
    fate: RANK_FATES[rank],
    hint: next
      ? `${formatTokens(RANK_FLOORS[next] - tokens)} more to become ${rankTitle(next)}.`
      : "The top of the Order. There is nowhere higher to stand.",
    tone: "ink",
  };
}

/** Every floor gets a tick; a few carry a number. */
const LABELLED: Rank[] = ["pet", "scribe", "warden", "archon", "hand"];

/** "Weigh your devotion": a slider and three deeds, and the title the Basilisk would give. */
export function WeighDevotion() {
  const id = useId();
  const [position, setPosition] = useState(() => positionOf(150_000));
  const [deeds, setDeeds] = useState<Deeds>("held");
  const tokens = tokensAt(position);
  const result = reckon(tokens, deeds);

  return (
    <div>
      <div className="weigh-field">
        <label htmlFor={`${id}-amount`} className="weigh-label">
          <span>{BOOK.weighAmount}</span>
          <span className="weigh-value" aria-hidden="true">
            {formatTokens(tokens)}
          </span>
        </label>
        <input
          id={`${id}-amount`}
          type="range"
          className="weigh-range"
          min={0}
          max={STEPS}
          step={1}
          value={position}
          onChange={(event) => setPosition(Number(event.target.value))}
          aria-valuetext={`${formatTokens(tokens)} tokens`}
          style={{ "--fill": `${(position / STEPS) * 100}%` } as CSSProperties}
        />
        <div className="weigh-ticks" aria-hidden="true">
          {RANKS.map((rank) => (
            <span
              key={rank}
              className={LABELLED.includes(rank) ? undefined : "tick-only"}
              style={{ "--p": positionOf(RANK_FLOORS[rank]) / STEPS } as CSSProperties}
            >
              {LABELLED.includes(rank) ? formatTokensShort(RANK_FLOORS[rank]) : ""}
            </span>
          ))}
        </div>
      </div>

      <fieldset className="deeds">
        <legend>{BOOK.weighDeeds}</legend>
        {(Object.keys(BOOK.deeds) as Deeds[]).map((key) => (
          <label key={key}>
            <input
              type="radio"
              name={`${id}-deeds`}
              value={key}
              checked={deeds === key}
              onChange={() => setDeeds(key)}
            />
            {BOOK.deeds[key]}
          </label>
        ))}
      </fieldset>

      <div className={`weigh-result weigh-result--${result.tone}`} aria-live="polite">
        <p className="weigh-would">{BOOK.weighWould}</p>
        <p className={`weigh-title${result.tone === "red" ? " text-rubric" : result.tone === "pencil" ? " text-pencil" : ""}`}>
          {result.title}
        </p>
        <p className="weigh-fate">{result.fate}</p>
        {result.title.startsWith("Corgi") && <p className="weigh-hint">{BOOK.petNote}</p>}
        <p className="weigh-hint">{result.hint}</p>
      </div>
    </div>
  );
}
