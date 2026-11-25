import Link from "next/link";
import { CARD, JUDGMENT, SITE } from "@/lib/basilisk/copy";
import { marksOf } from "@/lib/basilisk/marks";
import type { Verdict } from "@/lib/basilisk/types";
import { shortAddress } from "@/lib/solana/address";

/** Where the wallet stands, with its place in the Book when it has one. */
function bookLine(verdict: Verdict): string {
  if (verdict.entryNumber === null) return CARD.books[verdict.status];
  if (verdict.status === "traitor") return `${CARD.books.traitor}. ${JUDGMENT.struckFrom(verdict.entryNumber)}`;
  if (verdict.firstWitness) return `${CARD.books[verdict.status]}. ${JUDGMENT.firstWitness(verdict.entryNumber)}`;
  return `${CARD.books[verdict.status]}, ${CARD.entry(verdict.entryNumber)}`;
}

/**
 * A verdict on its own page, the one a shared link opens. Read-only: it is someone's entry,
 * so the way forward is to open it in the Book or to be judged yourself.
 */
export function VerdictSheet({ address, verdict }: { address: string; verdict: Verdict | null }) {
  if (!verdict) {
    return (
      <article className="sheet verdict-sheet">
        <div className="page-frame" aria-hidden="true" />
        <h1 className="sheet-title">{CARD.notFoundTitle}</h1>
        <p className="sheet-lede">{CARD.notFound}</p>
        <p className="verdict-actions">
          <Link className="codex-link codex-focus" href="/#judgment">
            {CARD.judgeYours}
          </Link>
        </p>
      </article>
    );
  }

  const traitor = verdict.status === "traitor";
  const prophecy = verdict.prophecy;
  return (
    <article className={`sheet verdict-sheet verdict-sheet--${verdict.status}`}>
      <div className="page-frame" aria-hidden="true" />
      <p className="sheet-kicker">
        {CARD.judged} <span className={traitor ? "codex-struck" : undefined}>{shortAddress(address)}</span>
      </p>
      <h1 className="sheet-title verdict-title">{verdict.title}</h1>
      <p className="verdict-book">{bookLine(verdict)}</p>
      {marksOf(verdict).length > 0 && (
        <ul className="entry-marks">
          {marksOf(verdict).map((mark) => (
            <li key={mark}>{mark}</li>
          ))}
        </ul>
      )}
      <p className="verdict-fate">{verdict.fate}</p>
      {prophecy && (
        <div className="prophecy verdict-prophecy">
          {prophecy.label && <p className="to">{prophecy.label}</p>}
          <p className="words">{prophecy.text}</p>
          {prophecy.punishment && (
            <>
              <p className="to">{JUDGMENT.sentence}</p>
              <p className="words">{prophecy.punishment}</p>
            </>
          )}
        </div>
      )}
      <p className="verdict-line">{verdict.line}</p>
      <p className="verdict-actions">
        <Link className="codex-link codex-focus" href={`/?wallet=${address}#judgment`}>
          {CARD.openInBook}
        </Link>
        <Link className="codex-link codex-focus" href="/#judgment">
          {CARD.judgeYours}
        </Link>
      </p>
      {verdict.demo && <p className="page-note">{SITE.demoNotice}</p>}
    </article>
  );
}
