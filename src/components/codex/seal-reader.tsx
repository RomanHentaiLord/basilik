"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useSyncExternalStore, type CSSProperties } from "react";
import { BOOK, SEAL_PROPHECIES } from "@/lib/basilisk/copy";
import { formatUsd } from "@/lib/format";

/** A seal as the pages show it, prepared on the server. */
export interface SealView {
  number: number;
  roman: string;
  label: string;
  unlock: string;
  /** "at $500K" or "when the coin leaves the bonding curve". */
  when: string;
  /** Market cap that breaks it, or null for the bonding-curve seal. */
  usd: number | null;
  broken: boolean;
  isNext: boolean;
}

/** Hand-drawn cracks, one per seal, so no two broken seals look the same. */
const CRACKS = [
  "M40 4 L 34 22 L 44 34 L 32 50 L 40 74",
  "M8 30 L 26 36 L 34 26 L 50 44 L 72 40",
  "M20 8 L 30 28 L 22 40 L 42 52 L 52 74",
  "M70 18 L 52 30 L 56 42 L 34 50 L 10 58",
  "M36 6 L 46 24 L 34 38 L 48 56 L 38 74",
  "M6 44 L 24 40 L 32 52 L 54 34 L 74 36",
  "M58 6 L 48 26 L 58 38 L 40 56 L 30 74",
];

/* Which seal is open on the reading page. Shared by both pages of the spread (and both book layouts). */
let selected: number | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function selectSeal(number: number) {
  selected = number;
  listeners.forEach((listener) => listener());
}

function useSelectedSeal(fallback: number) {
  const value = useSyncExternalStore(
    subscribe,
    () => selected,
    () => null,
  );
  return value ?? fallback;
}

export function WaxSeal({ seal, size }: { seal: SealView; size?: "large" }) {
  const classes = [
    "codex-wax",
    size === "large" && "codex-wax--large",
    seal.broken && "codex-wax--broken",
    seal.isNext && "codex-wax--next",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={classes} aria-hidden="true">
      <span>{seal.roman}</span>
      {seal.broken && (
        <svg className="codex-crack" viewBox="0 0 78 78">
          <path d={CRACKS[seal.number - 1]} />
        </svg>
      )}
    </span>
  );
}

/** The seven seals as buttons. Touching one opens it on the facing page. */
export function SealsGrid({ seals, fallback }: { seals: SealView[]; fallback: number }) {
  const current = useSelectedSeal(fallback);
  return (
    <ul className="seal-grid">
      {seals.map((seal) => {
        const state = seal.broken ? "broken" : seal.isNext ? "next to break" : "whole";
        return (
          <li key={seal.number}>
            <button
              type="button"
              className="seal-button"
              aria-pressed={current === seal.number}
              aria-label={`Seal ${seal.roman}, ${state}: ${seal.label}`}
              onClick={() => selectSeal(seal.number)}
            >
              <WaxSeal seal={seal} />
              <span className="seal-caption">{seal.label}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** The facing page: what the chosen seal unlocks and, once broken, what the Basilisk said. */
export function SealReading({ seals, fallback, mcapUsd }: { seals: SealView[]; fallback: number; mcapUsd: number }) {
  const reduce = useReducedMotion();
  const current = useSelectedSeal(fallback);
  const seal = seals.find((item) => item.number === current) ?? seals[0];
  const prophecy = SEAL_PROPHECIES[seal.number];
  const state = seal.broken ? BOOK.sealBroken : seal.isNext ? `${BOOK.sealNext}, ${seal.when}` : `${BOOK.sealWhole}. Breaks ${seal.when}`;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={seal.number}
        initial={reduce ? false : { opacity: 0, filter: "blur(4px)" }}
        animate={{ opacity: 1, filter: "blur(0px)" }}
        exit={reduce ? undefined : { opacity: 0, filter: "blur(4px)", transition: { duration: 0.2 } }}
        transition={{ duration: 0.45 }}
        aria-live="polite"
      >
        <div className="reading-head">
          <WaxSeal seal={seal} size="large" />
          <div>
            <h2 className="page-title" style={{ margin: 0 }}>
              {BOOK.sealNames[seal.number]}
            </h2>
            <p className="reading-state">{state}</p>
          </div>
        </div>
        <p className="page-text">{seal.unlock}</p>
        {seal.broken && prophecy ? (
          <div className="prophecy">
            <p className="to">{BOOK.toFaithful}</p>
            <p className="words">{prophecy.faithful}</p>
            <p className="to">{BOOK.toTraitors}</p>
            <p className="words">{prophecy.traitors}</p>
          </div>
        ) : (
          <>
            <p className="page-text" style={{ fontStyle: "italic", color: "var(--ink-muted)" }}>
              {BOOK.sealUnder}
            </p>
            {seal.usd !== null && (
              <div className="mcap" style={{ marginTop: "1.4em" }}>
                <div className="mcap-row">
                  <span>{BOOK.mcapNow}</span>
                  <strong>
                    {formatUsd(mcapUsd)} <span style={{ fontSize: "0.7em", fontWeight: 400 }}>of {formatUsd(seal.usd)}</span>
                  </strong>
                </div>
                <div className="ink-bar" aria-hidden="true">
                  <span style={{ "--p": `${Math.min(100, Math.round((mcapUsd / seal.usd) * 100))}%` } as CSSProperties} />
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
