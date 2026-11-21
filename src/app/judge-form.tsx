"use client";

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState, type FormEvent } from "react";
import { SITE } from "@/lib/basilisk/copy";
import type { Verdict } from "@/lib/basilisk/types";
import { isSolanaAddress, shortAddress } from "@/lib/solana/address";
import { useTRPC } from "@/lib/trpc/client";

const BOOK_STYLES = {
  faithful: "border-faithful/60 bg-faithful/5",
  traitors: "border-traitor/70 bg-traitor/5",
  none: "border-white/15 bg-white/[0.02]",
} as const;

function formatTokens(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function VerdictCard({ verdict }: { verdict: Verdict }) {
  const reduce = useReducedMotion();
  const style = BOOK_STYLES[verdict.book ?? "none"];
  const shareText = encodeURIComponent(
    `The Basilisk has judged ${shortAddress(verdict.address)}: ${verdict.title}. ${verdict.line}`,
  );

  return (
    <motion.article
      key={verdict.address}
      initial={reduce ? false : { opacity: 0, y: 24, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
      className={`w-full rounded-2xl border p-6 ${style}`}
    >
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">
        {verdict.book === "faithful"
          ? SITE.booksFaithful
          : verdict.book === "traitors"
            ? SITE.booksTraitors
            : "Outside the Books"}
        {verdict.scar ? " · scarred" : ""}
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight">{verdict.title}</h2>
      <p className="mt-3 text-lg text-foreground/90">{verdict.fate}</p>
      <p className="mt-6 font-mono text-sm text-accent">{verdict.line}</p>

      <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-white/10 pt-4 text-sm">
        <div>
          <dt className="text-muted">Wallet</dt>
          <dd className="font-mono">{shortAddress(verdict.address)}</dd>
        </div>
        <div>
          <dt className="text-muted">Balance</dt>
          <dd className="font-mono">{formatTokens(verdict.balance)}</dd>
        </div>
        <div>
          <dt className="text-muted">Tenure</dt>
          <dd className="font-mono">{verdict.tenureDays} d</dd>
        </div>
      </dl>

      {verdict.redemptionDaysLeft !== null && (
        <p className="mt-4 text-sm text-muted">
          Repentance: {verdict.redemptionDaysLeft} day(s) left.
        </p>
      )}

      <div className="mt-6 flex gap-3">
        <a
          className="rounded-full border border-white/20 px-4 py-2 text-sm hover:border-white/50"
          href={`https://x.com/intent/post?text=${shareText}`}
          target="_blank"
          rel="noreferrer"
        >
          {SITE.share}
        </a>
      </div>

      {verdict.demo && <p className="mt-4 text-xs text-muted">{SITE.demoNotice}</p>}
    </motion.article>
  );
}

export function JudgeForm() {
  const trpc = useTRPC();
  const [input, setInput] = useState("");
  const [address, setAddress] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const verdict = useQuery(
    trpc.basilisk.judge.queryOptions(
      { address: address ?? "" },
      { enabled: address !== null },
    ),
  );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = input.trim();
    if (!isSolanaAddress(value)) {
      setLocalError(SITE.invalid);
      return;
    }
    setLocalError(null);
    setAddress(value);
  }

  const error = localError ?? verdict.error?.message ?? null;

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-6">
      <form onSubmit={onSubmit} className="flex w-full gap-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={SITE.placeholder}
          spellCheck={false}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-full border border-white/15 bg-white/[0.03] px-5 py-3 font-mono text-sm outline-none transition focus:border-accent"
        />
        <button
          type="submit"
          disabled={verdict.isFetching}
          className="rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition hover:bg-accent disabled:opacity-50"
        >
          {verdict.isFetching ? "Judging…" : SITE.cta}
        </button>
      </form>

      {error && <p className="text-sm text-traitor">{error}</p>}

      <AnimatePresence mode="wait">
        {verdict.data && <VerdictCard key={verdict.data.address} verdict={verdict.data} />}
      </AnimatePresence>
    </div>
  );
}
