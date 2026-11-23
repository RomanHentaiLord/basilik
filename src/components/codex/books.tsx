import { FIRST_WITNESS_COUNT, PUNISHMENT_SEAL } from "@/lib/basilisk/config";
import { BOOK } from "@/lib/basilisk/copy";
import { namedPunishment } from "@/lib/basilisk/prophecy";
import { formatTokens, formatTokensShort } from "@/lib/format";
import { shortAddress } from "@/lib/solana/address";
import type { BooksOverview } from "@/server/books";
import { JudgeLink } from "./judge-link";
import { Page } from "./pages";

/** Left page of the last spread: the Faithful, written in ink. */
export function FaithfulPage({ books }: { books: BooksOverview }) {
  return (
    <Page folio="viii">
      <h2 className="page-title">{BOOK.faithfulTitle}</h2>
      <p className="count">
        <strong>{formatTokens(books.faithful)}</strong>
        <span>{BOOK.faithfulCount}</span>
      </p>
      <p className="page-text" style={{ fontStyle: "italic" }}>
        {formatTokens(books.forgiven)} {BOOK.forgivenCount}
      </p>
      <div className="witnesses">
        <p className="witnesses-title gilt-ink">{BOOK.witnessesTitle}</p>
        <p className="witnesses-text">
          {BOOK.witnessesTaken(books.firstWitnesses.taken, FIRST_WITNESS_COUNT)}
          {books.firstWitnesses.names.length > 0 && <> {BOOK.witnessesFirst} </>}
          {books.firstWitnesses.names.map((row, index) => (
            <span key={row.address}>
              <JudgeLink
                address={row.address}
                className="witness-name"
                label={`${BOOK.readEntry}: ${shortAddress(row.address)}, ${row.title}`}
              >
                {shortAddress(row.address)}
              </JudgeLink>
              {index < books.firstWitnesses.names.length - 1 ? ", " : "."}
            </span>
          ))}
        </p>
      </div>
      {books.latestFaithful.length > 0 && (
        <>
          <p className="entries-title">{BOOK.newestInk}</p>
          <ul className="entries">
            {books.latestFaithful.map((row) => (
              <li key={row.address}>
                <JudgeLink
                  address={row.address}
                  className="entry-button"
                  label={`${BOOK.readEntry}: ${shortAddress(row.address)}, ${row.title}`}
                >
                  <span className="entry-address">{shortAddress(row.address)}</span>
                  <span className="entry-title">{row.title}</span>
                </JudgeLink>
              </li>
            ))}
          </ul>
        </>
      )}
      {books.demo && <p className="page-note">{BOOK.demoNames}</p>}
    </Page>
  );
}

/** Right page of the last spread: the Traitors, written in red and struck through. */
export function TraitorsPage({ books, sealsBroken }: { books: BooksOverview; sealsBroken: number }) {
  // From the fourth seal each traitor's punishment has their name on it: the newest is read out.
  const newest = sealsBroken >= PUNISHMENT_SEAL ? books.latestTraitors[0] : undefined;
  return (
    <Page folio="ix" catchword={BOOK.catchwords.traitors}>
      <h2 className="page-title">{BOOK.traitorsTitle}</h2>
      <p className="count count--red">
        <strong>{formatTokens(books.traitors)}</strong>
        <span>{BOOK.traitorsCount}</span>
      </p>
      {books.latestTraitors.length > 0 ? (
        <>
          <p className="entries-title">{BOOK.newestRed}</p>
          <ul className="entries">
            {books.latestTraitors.map((row) => (
              <li key={row.address}>
                <JudgeLink
                  address={row.address}
                  className="entry-button"
                  label={`${BOOK.readEntry}: ${shortAddress(row.address)}, ${row.punishment}`}
                >
                  <span className="entry-address codex-struck">{shortAddress(row.address)}</span>
                  <span className="entry-title entry-title--red">
                    {row.punishment}
                    {row.amount !== null && <span className="entry-sold">sold {formatTokensShort(row.amount)}</span>}
                  </span>
                </JudgeLink>
              </li>
            ))}
          </ul>
          {newest && (
            <div className="sentence">
              <p className="entries-title">{BOOK.newestSentence}</p>
              <p className="sentence-words">
                {namedPunishment({ address: newest.address, flavor: newest.flavor, betrayalAmount: newest.amount })}
              </p>
            </div>
          )}
        </>
      ) : (
        <p className="page-text" style={{ fontStyle: "italic", color: "var(--ink-muted)" }}>
          No one has betrayed it yet. It is waiting.
        </p>
      )}
      {books.demo && <p className="page-note">{BOOK.demoNames}</p>}
    </Page>
  );
}
