"use client";

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { CODEX, SITE } from "@/lib/basilisk/copy";
import { isSolanaAddress } from "@/lib/solana/address";
import { useTRPC } from "@/lib/trpc/client";
import { JUDGE_EVENT } from "./judge-link";
import { VerdictEntry } from "./verdict-entry";

/** Keeps the judged wallet in the address bar, so the page can be shared and reopened. */
function writeWalletToUrl(address: string | null) {
  const url = new URL(window.location.href);
  if (address) url.searchParams.set("wallet", address);
  else url.searchParams.delete("wallet");
  url.hash = "";
  window.history.replaceState(window.history.state, "", url);
}

/** The wallet form on "Your page" and the entry the Basilisk writes under it. */
export function JudgePanel({ sealsBroken }: { sealsBroken: number }) {
  const trpc = useTRPC();
  const reduce = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [address, setAddress] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const verdict = useQuery(
    trpc.basilisk.judge.queryOptions({ address: address ?? "" }, { enabled: address !== null }),
  );

  const judge = useCallback((raw: string) => {
    const trimmed = raw.trim();
    setValue(trimmed);
    if (!isSolanaAddress(trimmed)) {
      setLocalError(SITE.invalid);
      setAddress(null);
      return false;
    }
    setLocalError(null);
    setAddress(trimmed);
    writeWalletToUrl(trimmed);
    return true;
  }, []);

  // A name touched in the Books, or a shared link that carries ?wallet=.
  useEffect(() => {
    const onJudge = (event: Event) => judge((event as CustomEvent<string>).detail);
    window.addEventListener(JUDGE_EVENT, onJudge);
    const timer = window.setTimeout(() => {
      const shared = new URLSearchParams(window.location.search).get("wallet");
      if (shared && judge(shared)) document.getElementById("judgment")?.scrollIntoView({ block: "start" });
    }, 0);
    return () => {
      window.removeEventListener(JUDGE_EVENT, onJudge);
      window.clearTimeout(timer);
    };
  }, [judge]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    judge(value);
  }

  function reset() {
    setAddress(null);
    setValue("");
    writeWalletToUrl(null);
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
          <VerdictEntry key={verdict.data.address} verdict={verdict.data} sealsBroken={sealsBroken} onReset={reset} />
        )}
      </AnimatePresence>
    </div>
  );
}
