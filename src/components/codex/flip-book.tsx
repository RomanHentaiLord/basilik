"use client";

import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CHAPTER_EVENT } from "./judge-link";

/**
 * A book whose pages turn as you scroll.
 *
 * The section is tall; inside it a sticky stage holds the book. Scroll progress becomes
 * `t`, a page clock: leaf k turns while t goes from k + 0.2 to k + 0.8, so every spread
 * rests for a moment before the next leaf lifts.
 *
 * "spread" mode (desktop) shows two pages: each leaf carries the right page of one spread on
 * its front and the left page of the next spread on its back. "single" mode (phones) shows one
 * page; each leaf turns away to the left and reveals the next.
 */

export interface LeafSpec {
  front: ReactNode;
  /** The left page of the next spread. Null in single mode. */
  back: ReactNode | null;
  /** The first leaf is the front cover: a little larger than the pages. */
  cover?: boolean;
}

export interface Chapter {
  roman: string;
  title: string;
  /** Spread to open, or an anchor to jump to. */
  spread?: number;
  href?: string;
}

interface Props {
  mode: "spread" | "single";
  label: string;
  leaves: LeafSpec[];
  /** The last page, lying under every leaf. */
  base: ReactNode;
  chapters?: Chapter[];
  /** Where each chapter of the table of contents opens in this layout. */
  chapterSpreads?: Record<string, number>;
  /** Something on the desk beside the closed book; it fades away as the book opens. */
  aside?: ReactNode;
}

const TURN_START = 0.2;
const TURN_END = 0.8;
/** Extra scroll after the last turn, so the final spread can be read before the book leaves. */
const TAIL = 0.6;

function easeInOut(x: number) {
  return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
}

/** 0 → leaf k lies flat on the right, 1 → it has turned over to the left. */
function turnOf(t: number, k: number) {
  const local = (t - k - TURN_START) / (TURN_END - TURN_START);
  return easeInOut(Math.min(1, Math.max(0, local)));
}

export function FlipBook({ mode, label, leaves, base, chapters, chapterSpreads, aside }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const count = leaves.length;

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const raw = useTransform(scrollYProgress, (p) => p * (count + TAIL));
  const t = useSpring(raw, { stiffness: 220, damping: 32, mass: 0.6, restDelta: 0.0005 });
  // A closed book shows only its cover: shift it left by half a page so the cover sits centred.
  const shift = useTransform(t, [TURN_START, TURN_END], mode === "spread" ? ["-25%", "0%"] : ["0%", "0%"]);

  const asideOpacity = useTransform(t, [0, 0.3], [1, 0]);
  const asideVisibility = useTransform(t, (value) => (value < 0.3 ? "visible" : "hidden"));

  const activeRef = useRef(0);
  const [active, setActive] = useState(0);
  useMotionValueEvent(t, "change", (value) => {
    const spread = Math.max(0, Math.min(count, Math.round(value)));
    if (spread !== activeRef.current) {
      activeRef.current = spread;
      if (chapters) setActive(spread);
    }
  });

  /** Scroll to the resting point of a spread. */
  const goTo = useCallback(
    (spread: number) => {
      const section = sectionRef.current;
      if (!section) return;
      const top = section.getBoundingClientRect().top + window.scrollY;
      const distance = section.offsetHeight - window.innerHeight;
      window.scrollTo({ top: top + (spread / (count + TAIL)) * distance, behavior: reduce ? "auto" : "smooth" });
    },
    [count, reduce],
  );

  // The table of contents asks for a chapter; only the layout on screen answers.
  useEffect(() => {
    if (!chapterSpreads) return;
    const onChapter = (event: Event) => {
      const section = sectionRef.current;
      const spread = chapterSpreads[(event as CustomEvent<string>).detail];
      if (!section || section.getClientRects().length === 0 || spread === undefined) return;
      goTo(spread);
    };
    window.addEventListener(CHAPTER_EVENT, onChapter);
    return () => window.removeEventListener(CHAPTER_EVENT, onChapter);
  }, [chapterSpreads, goTo]);

  /** Tabbing into a page that is not open turns the book to it. */
  const onFocusSpread = useCallback(
    (spread: number) => {
      if (reduce || activeRef.current === spread) return;
      goTo(spread);
    },
    [goTo, reduce],
  );

  const style = { height: `calc(${count + TAIL} * 100svh + 100svh)` } as CSSProperties;

  return (
    <section ref={sectionRef} className={`book-scroll book-scroll--${mode}`} style={style} aria-label={label}>
      <div className="book-stage">
        {aside && (
          <motion.div className="desk-aside" style={reduce ? undefined : { opacity: asideOpacity, visibility: asideVisibility }}>
            {aside}
          </motion.div>
        )}
        <motion.div className={`book book--${mode}`} style={reduce ? undefined : { x: shift }}>
          <div className="book-board" aria-hidden="true" />
          {leaves.map((leaf, k) => (
            <Leaf
              key={k}
              index={k}
              mode={mode}
              t={t}
              leaf={leaf}
              still={Boolean(reduce)}
              onFocusSpread={onFocusSpread}
            />
          ))}
          <div className="book-base" onFocusCapture={() => onFocusSpread(count)}>
            {base}
          </div>
          {chapters && (
            <ol className="thumb-index" aria-label="Chapters">
              {chapters.map((chapter) => (
                <li key={chapter.roman}>
                  {chapter.href ? (
                    <a className="thumb-tab" href={chapter.href} title={chapter.title}>
                      <span aria-hidden="true">{chapter.roman}</span>
                      <span className="sr-only">{chapter.title}</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      className="thumb-tab"
                      title={chapter.title}
                      aria-current={active === chapter.spread ? "true" : undefined}
                      onClick={() => goTo(chapter.spread ?? 0)}
                    >
                      <span aria-hidden="true">{chapter.roman}</span>
                      <span className="sr-only">{chapter.title}</span>
                    </button>
                  )}
                </li>
              ))}
            </ol>
          )}
        </motion.div>
      </div>
    </section>
  );
}

interface LeafProps {
  index: number;
  mode: Props["mode"];
  t: MotionValue<number>;
  leaf: LeafSpec;
  still: boolean;
  onFocusSpread: (spread: number) => void;
}

function Leaf({ index, mode, t, leaf, still, onFocusSpread }: LeafProps) {
  const angle = useTransform(t, (value) => -180 * turnOf(value, index));
  // Unturned leaves stack with the first on top; turned ones with the latest on top; the turning one above all.
  const zIndex = useTransform(t, (value) => {
    const local = value - index;
    if (local <= TURN_START) return 50 - index;
    if (local >= TURN_END) return 10 + index;
    return 100;
  });
  // Only the leaves that can be seen are painted: the open spread and the one being turned.
  // The front board stays: once open it is the leather under the left-hand pages.
  const reach = mode === "spread" ? (leaf.cover ? Infinity : 1.8) : 0.8;
  const visibility = useTransform(t, (value) =>
    value >= index - 0.8 && value <= index + reach ? "visible" : "hidden",
  );
  const frontShade = useTransform(angle, [0, -90], [0, 0.5]);
  const backShade = useTransform(angle, [-90, -180], [0.5, 0]);

  const frontSpread = index;
  const backSpread = index + 1;

  return (
    <motion.div
      className={`leaf${leaf.cover ? " leaf--cover" : ""}`}
      style={still ? undefined : { rotateY: angle, zIndex, visibility }}
    >
      <div className="leaf-face leaf-face--front" onFocusCapture={() => onFocusSpread(frontSpread)}>
        {leaf.front}
        <motion.div className="leaf-shade leaf-shade--front" style={{ opacity: frontShade }} aria-hidden="true" />
      </div>
      <div
        className="leaf-face leaf-face--back"
        onFocusCapture={leaf.back ? () => onFocusSpread(backSpread) : undefined}
        aria-hidden={leaf.back ? undefined : true}
      >
        {leaf.back}
        <motion.div className="leaf-shade leaf-shade--back" style={{ opacity: backShade }} aria-hidden="true" />
      </div>
    </motion.div>
  );
}
