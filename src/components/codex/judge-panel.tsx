"use client";

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef, useState, type FormEvent } from "react";
import { CODEX, SITE } from "@/lib/basilisk/copy";
import { isSolanaAddress } from "@/lib/solana/address";
import { useTRPC } from "@/lib/trpc/client";
import { VerdictEntry } from "./verdict-entry";

/** The wallet form and the verdict that follows it. */
export function JudgePanel() {
  const trpc = useTRPC();
  const reduce = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [address, setAddress] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const verdict = useQuery(
    trpc.basilisk.judge.queryOptions({ address: address ?? "" }, { enabled: address !== null }),
  );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!isSolanaAddress(trimmed)) {
      setLocalError(SITE.invalid);
      setAddress(null);
      return;
    }
    setLocalError(null);
    setAddress(trimmed);
  }

  function reset() {
    setAddress(null);
    setValue("");
    inputRef.current?.focus();
  }

  const error = localError ?? verdict.error?.message ?? null;
  const reading = verdict.isFetching && !verdict.data;

  return (
    <div>
      <form onSubmit={onSubmit} noValidate>
        <label htmlFor="wallet" className="mb-1.5 block text-[17px] italic text-ink-muted">
          {CODEX.walletLabel}
        </label>
        <div className="flex flex-wrap items-end gap-3.5">
          <input
            ref={inputRef}
            id="wallet"
            name="wallet"
            className="codex-input"
            placeholder={SITE.placeholder}
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "wallet-error" : undefined}
          />
          <button type="submit" className="codex-button" disabled={verdict.isFetching}>
            {SITE.cta}
          </button>
        </div>
      </form>

      {error && (
        <p id="wallet-error" role="alert" className="mt-3 mb-0 text-[18px] italic text-rubric">
          {error}
        </p>
      )}

      {reading && (
        <p className="mt-6 mb-0 text-[19px] italic text-ink-muted" aria-live="polite">
          {CODEX.reading}
          <span aria-hidden="true">
            {[0, 1, 2].map((dot) => (
              <motion.span
                key={dot}
                initial={reduce ? false : { opacity: 0.25 }}
                animate={reduce ? undefined : { opacity: [0.25, 1, 0.25] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: dot * 0.2 }}
              >
                .
              </motion.span>
            ))}
          </span>
        </p>
      )}

      <AnimatePresence mode="wait">
        {address && verdict.data && !verdict.isFetching && (
          <VerdictEntry key={verdict.data.address} verdict={verdict.data} onReset={reset} />
        )}
      </AnimatePresence>
    </div>
  );
}
