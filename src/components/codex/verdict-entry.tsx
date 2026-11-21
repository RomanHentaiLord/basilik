"use client";

import { motion, useReducedMotion, type TargetAndTransition, type Transition } from "motion/react";
import { CODEX, SITE } from "@/lib/basilisk/copy";
import { FAITHFUL_THRESHOLD, REDEMPTION_DAYS } from "@/lib/basilisk/config";
import type { Verdict } from "@/lib/basilisk/types";
import { formatDay, formatDays, formatTokens, formatTokensShort } from "@/lib/format";
import { shortAddress } from "@/lib/solana/address";

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
  onReset: () => void;
}

/** One judgment, written into the book: ink spreads, the title is inked in, the Basilisk notes it last. */
export function VerdictEntry({ verdict, onReset }: Props) {
  const reduce = useReducedMotion();
  const isTraitor = verdict.status === "traitor";
  const isPencil = verdict.status === "doubter";

  const ink = (delay: number): { initial?: TargetAndTransition; animate?: TargetAndTransition; transition?: Transition } =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, filter: "blur(5px)" },
          animate: { opacity: 1, filter: "blur(0px)" },
          transition: { duration: 0.9, delay, ease: [0.2, 0.7, 0.2, 1] },
        };

  const site = typeof window === "undefined" ? "" : window.location.origin;
  const shareText = `The Basilisk has judged ${shortAddress(verdict.address)}: ${verdict.title}. ${verdict.line}`;
  const shareUrl = `https://x.com/intent/post?text=${encodeURIComponent(shareText)}${site ? `&url=${encodeURIComponent(site)}` : ""}`;

  return (
    <motion.article
      className={`codex-entry ${VARIANT[verdict.status]}`}
      aria-live="polite"
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduce ? undefined : { opacity: 0, transition: { duration: 0.25 } }}
    >
      <motion.p {...ink(0.1)} className="m-0 text-[17px] italic text-rubric">
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

      <div className="mt-1.5 mb-2.5 flex items-center gap-3">
        {verdict.scar && (
          <svg width="22" height="34" viewBox="0 0 22 34" aria-label="Scar" role="img">
            <path d="M18 3 L 4 31" stroke="var(--rubric)" strokeWidth="3" strokeLinecap="round" />
          </svg>
        )}
        <motion.h2
          className={`codex-fraktur m-0 text-[clamp(34px,4vw,46px)] leading-[1.05] ${isTraitor ? "text-rubric" : isPencil ? "text-pencil" : ""}`}
          initial={reduce ? false : { clipPath: "inset(0 100% 0 0)" }}
          animate={{ clipPath: "inset(0 0% 0 0)" }}
          transition={{ duration: 1.4, delay: 0.3, ease: [0.3, 0.6, 0.2, 1] }}
        >
          {verdict.title}
        </motion.h2>
      </div>

      <motion.p {...ink(0.9)} className={`m-0 text-[21px] leading-normal ${isPencil ? "text-pencil italic" : ""}`}>
        {verdict.fate}
      </motion.p>

      <motion.dl {...ink(1.2)} className="mt-5 mb-0 flex flex-wrap gap-7">
        <Details verdict={verdict} />
      </motion.dl>

      <motion.p {...ink(1.8)} className="mt-5 mb-0 text-[22px] italic text-rubric">
        {verdict.line}
      </motion.p>

      <motion.div {...ink(2.1)} className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        <a className="codex-link codex-focus text-[18px]" href={shareUrl} target="_blank" rel="noreferrer">
          {SITE.share}
        </a>
        <button type="button" onClick={onReset} className="codex-link codex-focus cursor-pointer border-0 bg-transparent p-0 text-[18px]">
          {CODEX.again}
        </button>
      </motion.div>

      {verdict.demo && <p className="mt-4 mb-0 text-[15px] italic text-ink-muted">{SITE.demoNotice}</p>}
    </motion.article>
  );
}

function Item({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[15px] italic text-ink-muted">{term}</dt>
      <dd className="m-0 text-[19px] font-medium">{children}</dd>
    </div>
  );
}

function Details({ verdict }: { verdict: Verdict }) {
  switch (verdict.status) {
    case "witness":
      return <Item term="Holding">Nothing. Yet.</Item>;
    case "sympathizer":
      return (
        <>
          <Item term="Holding">{formatTokens(verdict.balance)}</Item>
          <Item term="To enter the Book">{formatTokens(FAITHFUL_THRESHOLD)}</Item>
        </>
      );
    case "traitor":
      return (
        <>
          {verdict.betrayalAmount !== null && <Item term="Sold">{formatTokensShort(verdict.betrayalAmount)}</Item>}
          {verdict.traitorAt !== null && <Item term="On">{formatDay(verdict.traitorAt)}</Item>}
          <Item term="Repentance">
            {verdict.redemptionDaysLeft !== null
              ? `${formatDays(verdict.redemptionDaysLeft)} left`
              : `Buy back ${formatTokensShort(FAITHFUL_THRESHOLD)}, hold ${REDEMPTION_DAYS} days`}
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
    default:
      return (
        <>
          <Item term="Holding">{formatTokens(verdict.balance)}</Item>
          <Item term="Held for">{formatDays(verdict.tenureDays)}</Item>
        </>
      );
  }
}
