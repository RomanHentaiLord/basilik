"use client";

import { motion, useReducedMotion, type TargetAndTransition, type Transition } from "motion/react";
import { useId, useState } from "react";
import { FAITHFUL_THRESHOLD, REDEMPTION_MS, REPENTANCE_SEAL } from "@/lib/basilisk/config";
import { CODEX, JUDGMENT, ORDINALS, RANK_TITLES, SEAL_PROPHECIES, SITE } from "@/lib/basilisk/copy";
import { marksOf } from "@/lib/basilisk/marks";
import { nextRankStep, tokensToEnter, untilInk } from "@/lib/basilisk/progress";
import type { Verdict, WalletProphecy } from "@/lib/basilisk/types";
import { formatDay, formatDuration, formatTokens, formatTokensShort } from "@/lib/format";
import { shortAddress } from "@/lib/solana/address";
import { CopyButton } from "./copy-address";
import { Emblem } from "./ornaments";

const VARIANT: Record<Verdict["status"], string> = {
  witness: "codex-entry--outside",
  sympathizer: "codex-entry--outside",
  faithful: "",
  forgiven: "",
  doubter: "codex-entry--pencil",
  traitor: "codex-entry--traitor",
};

const BOOK_LINE: Record<Verdict["status"], string> = {
  witness: CODEX.outside,
  sympathizer: CODEX.outside,
  faithful: SITE.booksFaithful,
  forgiven: `${SITE.booksFaithful}, with a scar`,
  doubter: `${SITE.booksFaithful}, in pencil`,
  traitor: SITE.booksTraitors,
};

interface Props {
  verdict: Verdict;
  sealsBroken: number;
  /** This wallet is the one the visitor keeps as their own on this device. */
  isMine: boolean;
  onRemember: () => void;
  onForget: () => void;
  onReset: () => void;
}

type Reveal = { initial?: TargetAndTransition; animate?: TargetAndTransition; transition?: Transition };

/** One judgment, written onto the page: ink spreads, the title is inked in, the seal is pressed last. */
export function VerdictEntry({ verdict, sealsBroken, isMine, onRemember, onForget, onReset }: Props) {
  const reduce = useReducedMotion();
  const [now] = useState(() => Date.now());
  const isTraitor = verdict.status === "traitor";
  const isPencil = verdict.status === "doubter";
  const stamp = verdict.status === "faithful" || verdict.status === "forgiven" ? "red" : isTraitor ? "black" : null;

  const ink = (delay: number): Reveal =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, filter: "blur(5px)" },
          animate: { opacity: 1, filter: "blur(0px)" },
          transition: { duration: 0.9, delay, ease: [0.2, 0.7, 0.2, 1] },
        };

  // The verdict's own page carries the card image that X and messengers show.
  const pageUrl = `${window.location.origin}/v/${verdict.address}`;
  const shareUrl = `https://x.com/intent/post?text=${encodeURIComponent(shareText(verdict))}&url=${encodeURIComponent(pageUrl)}`;
  const prophecy = verdict.prophecy ?? prophecyFor(verdict, sealsBroken);
  const marks = marksOf(verdict);

  return (
    <motion.article
      className={`codex-entry ${VARIANT[verdict.status]}`}
      aria-live="polite"
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduce ? undefined : { opacity: 0, transition: { duration: 0.25 } }}
    >
      {stamp && <WaxStamp tone={stamp} delay={reduce ? 0 : 2.4} still={Boolean(reduce)} />}

      <motion.p {...ink(0.1)} className="m-0 pr-16 text-[17px] italic text-rubric">
        {BOOK_LINE[verdict.status]}. {CODEX.judgmentOf}{" "}
        <span className="relative inline-block">
          {shortAddress(verdict.address)}
          {isTraitor && (
            <motion.span
              aria-hidden="true"
              className="absolute top-[55%] right-0 left-0 h-[2px] origin-left bg-rubric"
              initial={reduce ? false : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.5, delay: 1.1, ease: "easeIn" }}
            />
          )}
        </span>
      </motion.p>

      <div className="mt-1.5 mb-2.5 flex items-center gap-3 pr-14">
        {verdict.scar && (
          <svg width="22" height="34" viewBox="0 0 22 34" aria-label="Scar" role="img">
            <path d="M18 3 L 4 31" stroke="var(--rubric)" strokeWidth="3" strokeLinecap="round" />
          </svg>
        )}
        <motion.h3
          className={`codex-fraktur m-0 text-[clamp(34px,5vw,50px)] leading-[1.05] ${isTraitor ? "text-rubric" : isPencil ? "text-pencil" : ""}`}
          initial={reduce ? false : { clipPath: "inset(0 100% 0 0)" }}
          animate={{ clipPath: "inset(0 0% 0 0)" }}
          transition={{ duration: 1.4, delay: 0.3, ease: [0.3, 0.6, 0.2, 1] }}
        >
          {verdict.title}
        </motion.h3>
      </div>

      {verdict.entryNumber !== null && (
        <motion.p {...ink(0.7)} className={`entry-place${verdict.firstWitness && !isTraitor ? " entry-place--gilt" : ""}`}>
          {isTraitor
            ? JUDGMENT.struckFrom(verdict.entryNumber)
            : verdict.firstWitness
              ? JUDGMENT.firstWitness(verdict.entryNumber)
              : JUDGMENT.entryNo(verdict.entryNumber)}
        </motion.p>
      )}

      {marks.length > 0 && (
        <motion.ul {...ink(0.8)} className="entry-marks">
          {marks.map((mark) => (
            <li key={mark}>{mark}</li>
          ))}
        </motion.ul>
      )}

      <motion.p {...ink(0.9)} className={`m-0 text-[21px] leading-normal ${isPencil ? "text-pencil italic" : ""}`}>
        {verdict.fate}
      </motion.p>

      <motion.dl {...ink(1.2)} className="entry-stats">
        <Stats verdict={verdict} now={now} sealsBroken={sealsBroken} />
      </motion.dl>

      <motion.div {...ink(1.6)} className="entry-prophecy">
        {prophecy.label && <p className="text-[16px] italic text-rubric">{prophecy.label}</p>}
        <p className="mt-1 text-[20px] leading-normal">{prophecy.text}</p>
        {prophecy.punishment && (
          <>
            <p className="mt-3 text-[16px] italic text-rubric">{JUDGMENT.sentence}</p>
            <p className="mt-1 text-[20px] leading-normal">{prophecy.punishment}</p>
          </>
        )}
      </motion.div>

      <motion.p {...ink(2)} className="mt-5 mb-0 text-[22px] italic text-rubric">
        {verdict.line}
      </motion.p>

      <motion.div {...ink(2.2)} className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        <a className="codex-link codex-focus text-[18px]" href={shareUrl} target="_blank" rel="noreferrer">
          {SITE.share}
        </a>
        <CopyButton text={pageUrl} label={JUDGMENT.copyLink} done={JUDGMENT.linkCopied} />
        <button
          type="button"
          onClick={onReset}
          className="codex-link codex-focus cursor-pointer border-0 bg-transparent p-0 text-[18px]"
        >
          {CODEX.again}
        </button>
      </motion.div>

      <motion.p {...ink(2.4)} className="mt-4 mb-0 text-[16px] italic text-ink-muted">
        {isMine ? (
          <>
            {JUDGMENT.remembered}{" "}
            <button type="button" onClick={onForget} className="codex-link codex-focus cursor-pointer border-0 bg-transparent p-0 italic">
              {JUDGMENT.forgetMe}
            </button>
          </>
        ) : (
          <button type="button" onClick={onRemember} className="codex-link codex-focus cursor-pointer border-0 bg-transparent p-0 italic">
            {JUDGMENT.rememberMine}
          </button>
        )}
      </motion.p>

      {verdict.demo && <p className="mt-4 mb-0 text-[15px] italic text-ink-muted">{SITE.demoNotice}</p>}
    </motion.article>
  );
}

/** What goes into the post on X, next to the link to the verdict's page. */
export function shareText(verdict: Verdict): string {
  return `The Basilisk has judged ${shortAddress(verdict.address)}: ${verdict.title}. ${verdict.line}`;
}

/** The seal's written words, for a verdict that came without the server's prophecy. */
function prophecyFor(verdict: Verdict, sealsBroken: number): WalletProphecy {
  const words = SEAL_PROPHECIES[sealsBroken];
  if (sealsBroken <= 0 || !words) return { label: null, text: JUDGMENT.silent, punishment: null };
  const label = JUDGMENT.prophecyFor(ORDINALS[sealsBroken]);
  if (verdict.status === "traitor") return { label, text: words.traitors, punishment: null };
  if (verdict.book === "faithful") return { label, text: words.faithful, punishment: null };
  return { label: JUDGMENT.prophecyOutside, text: words.faithful, punishment: null };
}

function Item({
  term,
  children,
  note,
  full,
}: {
  term: string;
  children: React.ReactNode;
  note?: string | null;
  full?: boolean;
}) {
  return (
    <div className={full ? "full" : undefined}>
      <dt>{term}</dt>
      <dd>
        {children}
        {note && <small>{note}</small>}
      </dd>
    </div>
  );
}

function Stats({ verdict, now, sealsBroken }: { verdict: Verdict; now: number; sealsBroken: number }) {
  switch (verdict.status) {
    case "witness":
      return (
        <>
          <Item term={JUDGMENT.holding}>{JUDGMENT.nothingYet}</Item>
          <Item term={JUDGMENT.toEnter}>{formatTokens(FAITHFUL_THRESHOLD)}</Item>
        </>
      );
    case "sympathizer":
      return (
        <>
          <Item term={JUDGMENT.holding}>{formatTokens(verdict.balance)}</Item>
          <Item term={JUDGMENT.toEnter}>
            {formatTokens(tokensToEnter(verdict.balance))} {JUDGMENT.more}
          </Item>
        </>
      );
    case "traitor":
      return (
        <>
          {verdict.betrayalAmount !== null && (
            <Item term={JUDGMENT.sold}>{formatTokensShort(verdict.betrayalAmount)}</Item>
          )}
          {verdict.traitorAt !== null && <Item term={JUDGMENT.on}>{formatDay(verdict.traitorAt)}</Item>}
          <Item term={JUDGMENT.holding}>{formatTokens(verdict.balance)}</Item>
          <Item term={JUDGMENT.repentance}>
            {sealsBroken < REPENTANCE_SEAL
              ? JUDGMENT.repentLocked
              : verdict.redemptionMsLeft !== null
                ? `${formatDuration(verdict.redemptionMsLeft, "up")} left`
                : `Buy back ${formatTokensShort(FAITHFUL_THRESHOLD)}, hold ${formatDuration(REDEMPTION_MS)}`}
          </Item>
          {!verdict.demo && verdict.betrayalSignature && (
            <Item term="Proof">
              <a
                className="codex-link codex-focus"
                href={`https://solscan.io/tx/${verdict.betrayalSignature}`}
                target="_blank"
                rel="noreferrer"
              >
                The sale
              </a>
            </Item>
          )}
        </>
      );
    case "doubter": {
      const ink = untilInk(verdict.lastSellAt, now);
      return (
        <>
          <Item term={JUDGMENT.holding}>{formatTokens(verdict.balance)}</Item>
          {verdict.lastSellAt !== null && <Item term={JUDGMENT.lastSale}>{formatDay(verdict.lastSellAt)}</Item>}
          {ink !== null && <Item term={JUDGMENT.inkIn}>{formatDuration(ink, "up")}</Item>}
        </>
      );
    }
    default: {
      const step = nextRankStep(verdict);
      return (
        <>
          <Item term={JUDGMENT.holding}>{formatTokens(verdict.balance)}</Item>
          <Item term={JUDGMENT.heldFor}>{formatDuration(verdict.tenureMs)}</Item>
          {verdict.peak > verdict.balance && <Item term={JUDGMENT.peak}>{formatTokens(verdict.peak)}</Item>}
          <Item
            full
            term={JUDGMENT.nextRank}
            note={
              step
                ? `${formatTokens(step.more)} ${JUDGMENT.more}${step.wait !== null ? `, ${JUDGMENT.orHold(formatDuration(step.wait, "up"))}` : ""}`
                : null
            }
          >
            {step ? RANK_TITLES[step.rank as Exclude<typeof step.rank, "pet">] : JUDGMENT.topOfOrder}
          </Item>
        </>
      );
    }
  }
}

/** A wax seal pressed onto the entry: red for the Faithful, black for traitors. */
function WaxStamp({ tone, delay, still }: { tone: "red" | "black"; delay: number; still: boolean }) {
  const id = useId().replace(/:/g, "");
  const colors =
    tone === "red"
      ? { light: "#d4554a", mid: "#9e1b1b", dark: "#5c0d0c", emboss: "rgba(60, 6, 5, 0.6)" }
      : { light: "#5a514c", mid: "#2b2523", dark: "#0f0c0b", emboss: "rgba(0, 0, 0, 0.6)" };
  return (
    <motion.div
      className="wax-stamp"
      initial={still ? false : { opacity: 0, scale: 1.9, rotate: -32 }}
      animate={{ opacity: 1, scale: 1, rotate: -9 }}
      transition={{ type: "spring", stiffness: 420, damping: 19, delay }}
      role="img"
      aria-label={JUDGMENT.sealedBy}
    >
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        <defs>
          <radialGradient id={`${id}-wax`} cx="0.38" cy="0.32" r="0.75">
            <stop offset="0" stopColor={colors.light} />
            <stop offset="0.5" stopColor={colors.mid} />
            <stop offset="1" stopColor={colors.dark} />
          </radialGradient>
        </defs>
        <path
          d="M50 4 C 62 3, 70 9, 78 12 C 88 16, 96 28, 95 40 C 99 52, 96 64, 90 72 C 86 84, 74 94, 60 95 C 50 99, 38 97, 28 92 C 16 88, 6 76, 5 62 C 1 52, 3 38, 9 28 C 14 16, 26 7, 38 6 C 42 4, 46 4, 50 4 Z"
          fill={`url(#${id}-wax)`}
          style={{ filter: "drop-shadow(1px 2px 1.5px rgba(0,0,0,0.45))" }}
        />
        <circle cx="50" cy="50" r="33" fill="none" stroke={colors.emboss} strokeWidth="2.5" />
        <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(255,230,210,0.18)" strokeWidth="1" />
        <g style={{ color: colors.emboss }}>
          <svg x="22" y="22" width="56" height="56" viewBox="0 0 100 100">
            <Emblem tone="wax" />
          </svg>
        </g>
      </svg>
    </motion.div>
  );
}
