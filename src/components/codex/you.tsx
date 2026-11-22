"use client";

import { useId, useState, type FormEvent } from "react";
import type { Rank } from "@/lib/basilisk/config";
import { BOOK, JUDGMENT, SITE } from "@/lib/basilisk/copy";
import { isSolanaAddress } from "@/lib/solana/address";
import { identityLabel, useIdentity } from "./identity";
import { goToChapter, requestJudgment } from "./judge-link";

/** The header button: "Who am I?" until the visitor has judged their own wallet, then their rank. */
export function WhoAmI() {
  const me = useIdentity();
  return (
    <a className="header-cta codex-focus" href="#judgment" aria-label={me ? `${JUDGMENT.header.you}: ${me.title}` : undefined}>
      {me ? (
        <>
          <span className="long">{JUDGMENT.header.you}:&nbsp;</span>
          <strong>{identityLabel(me)}</strong>
        </>
      ) : (
        JUDGMENT.header.whoAmI
      )}
    </a>
  );
}

/** The line on the cover under the title, and the way to your page. Greets a returning visitor. */
export function CoverGreeting() {
  const me = useIdentity();
  return (
    <>
      <p className="cover-sub">{me ? `${BOOK.welcomeBack}, ${me.title}.` : BOOK.coverLine}</p>
      <button type="button" className="cover-cta" onClick={() => goToChapter("judgment")}>
        {me ? BOOK.openMyPage : JUDGMENT.header.whoAmI}
      </button>
    </>
  );
}

/** A short wallet form next to the closed book, for those who will not scroll. */
export function QuickJudge() {
  const id = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = value.trim();
    if (!isSolanaAddress(address)) {
      setError(true);
      return;
    }
    setError(false);
    requestJudgment(address, true);
  }

  return (
    <form className="quick-judge" onSubmit={onSubmit} noValidate>
      <label htmlFor={`${id}-wallet`}>{BOOK.desk.label}</label>
      <div>
        <input
          id={`${id}-wallet`}
          className="codex-input"
          placeholder={SITE.placeholder}
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-invalid={error || undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <button type="submit" className="codex-button">
          {SITE.cta}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="quick-error">
          {SITE.invalid}
        </p>
      )}
    </form>
  );
}

export interface LadderRow {
  rank: Rank;
  name: string;
  floor: string;
  duty: string;
}

/** A part of the Order of the Faithful. The visitor's own rank is marked with a pointing hand. */
export function OrderLadder({ rows }: { rows: LadderRow[] }) {
  const me = useIdentity();
  const myRank = me && me.status !== "traitor" ? me.rank : null;
  return (
    <ol className="order-list">
      {rows.map((row) => {
        const mine = row.rank === myRank;
        return (
          <li key={row.rank} className={mine ? "is-you" : undefined} aria-current={mine ? "true" : undefined}>
            <div className="order-head">
              <span className="order-name">{row.name}</span>
              <span className="order-floor">{row.floor}</span>
            </div>
            <p className="order-fate">
              {mine && <span className="order-you">{BOOK.orderYou}. </span>}
              {row.duty}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
