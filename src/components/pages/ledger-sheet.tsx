import Link from "next/link";
import { JudgeEntryLink } from "@/components/pages/judge-entry-link";
import { CopyButton } from "@/components/codex/copy-address";
import { LEDGER, CODEX } from "@/lib/basilisk/copy";
import {
  formatMoment,
  formatShare,
  formatTokens,
  formatTokensShort,
} from "@/lib/format";
import { shortAddress } from "@/lib/solana/address";
import type { BurnsOverview, Offering } from "@/server/burns";

const ROMAN = ["I", "II", "III"];

/** Who made the offering: the Altar, or a holder with their title in the Books. */
function OfferedBy({ offering }: { offering: Offering }) {
  if (offering.altar)
    return <span className="ledger-altar">{LEDGER.theAltar}</span>;
  if (!offering.burner) return <span>{LEDGER.aHolder}</span>;
  return (
    <span className="ledger-by">
      <JudgeEntryLink
        address={offering.burner}
        label={`${LEDGER.readEntry}: ${shortAddress(offering.burner)}`}
      >
        {shortAddress(offering.burner)}
      </JudgeEntryLink>
      <span className="ledger-title">{offering.title ?? LEDGER.aHolder}</span>
    </span>
  );
}

/** The link to a burn's transaction (none for the imaginary burns before launch). */
function Proof({ offering, demo }: { offering: Offering; demo: boolean }) {
  if (demo) return <span className="ledger-muted">{LEDGER.proof}</span>;
  return (
    <a
      className="codex-link codex-focus"
      href={`https://solscan.io/tx/${offering.signature}`}
      target="_blank"
      rel="noreferrer"
    >
      {LEDGER.proof}
    </a>
  );
}

/** Phones: the same ledger as entries of three lines, since five columns do not fit. */
function LedgerList({
  offerings,
  demo,
}: {
  offerings: Offering[];
  demo: boolean;
}) {
  return (
    <ol className="ledger-list" aria-label={LEDGER.title}>
      {offerings.map((offering) => (
        <li
          key={offering.signature}
          className={offering.altar ? "ledger-row--altar" : undefined}
        >
          <span className="ledger-list-no">
            <span className="sr-only">{LEDGER.columns.number} </span>
            {offering.number}
          </span>
          <span className="ledger-list-amount">
            {formatTokens(offering.amount)}{" "}
            <span className="ledger-muted">{LEDGER.burnedShort}</span>
          </span>
          <span className="ledger-list-by">
            <OfferedBy offering={offering} />
          </span>
          <span className="ledger-list-when">{formatMoment(offering.at)}</span>
          <span className="ledger-list-proof">
            <Proof offering={offering} demo={demo} />
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Every burn of the coin, the Altar's rule, and the tops of both Books. */
export function LedgerSheet({ overview }: { overview: BurnsOverview }) {
  const { demo, altar } = overview;
  return (
    <article className="sheet ledger-sheet">
      <div className="page-frame" aria-hidden="true" />
      <header>
        <h1 className="sheet-title">{LEDGER.title}</h1>
        <p className="sheet-lede ledger-lede">{LEDGER.lede}</p>
      </header>

      <section className="ledger-sum" aria-label={LEDGER.burned}>
        <p className="count">
          <strong>{formatTokens(overview.total)}</strong>
          <span>{LEDGER.burned}</span>
        </p>
        <p className="ledger-sum-line">
          {LEDGER.share(formatShare(overview.share))}.{" "}
          {LEDGER.offerings(overview.count)}:{" "}
          {formatTokensShort(overview.altarTotal)} {LEDGER.byAltar},{" "}
          {formatTokensShort(overview.holdersTotal)} {LEDGER.byHolders}.
        </p>
      </section>

      <section className="ledger-rule" aria-labelledby="ledger-rule">
        <h2 id="ledger-rule" className="ledger-heading">
          {LEDGER.ruleTitle}
        </h2>
        <p>{LEDGER.rule}</p>
        {altar && !demo ? (
          <p className="ledger-altar-line">
            {LEDGER.altarIs}{" "}
            <a
              className="codex-link codex-focus"
              href={`https://solscan.io/account/${altar}`}
              target="_blank"
              rel="noreferrer"
            >
              {shortAddress(altar)}
            </a>
            .{" "}
            <CopyButton
              text={altar}
              label={LEDGER.copyAltar}
              done={CODEX.copied}
            />{" "}
            <Link className="codex-link codex-focus" href="/altar">
              {LEDGER.altarPage}
            </Link>
          </p>
        ) : (
          <p className="ledger-altar-line">
            {LEDGER.altarUnset}{" "}
            <Link className="codex-link codex-focus" href="/altar">
              {LEDGER.altarPage}
            </Link>
          </p>
        )}
      </section>

      {overview.offerings.length === 0 ? (
        <p className="ledger-empty">{LEDGER.empty}</p>
      ) : (
        <>
          <LedgerList offerings={overview.offerings} demo={demo} />
          <div className="ledger-scroll">
            <table className="ledger">
              <thead>
                <tr>
                  <th scope="col" className="ledger-no">
                    {LEDGER.columns.number}
                  </th>
                  <th scope="col">{LEDGER.columns.when}</th>
                  <th scope="col">{LEDGER.columns.by}</th>
                  <th scope="col" className="ledger-amount">
                    {LEDGER.columns.amount}
                  </th>
                  <th scope="col" className="ledger-proof">
                    {LEDGER.columns.proof}
                  </th>
                </tr>
              </thead>
              <tbody>
                {overview.offerings.map((offering) => (
                  <tr
                    key={offering.signature}
                    className={offering.altar ? "ledger-row--altar" : undefined}
                  >
                    <td className="ledger-no">{offering.number}</td>
                    <td className="ledger-when">{formatMoment(offering.at)}</td>
                    <td>
                      <OfferedBy offering={offering} />
                    </td>
                    <td className="ledger-amount">
                      {formatTokens(offering.amount)}
                    </td>
                    <td className="ledger-proof">
                      <Proof offering={offering} demo={demo} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="ledger-tops">
        <section aria-labelledby="ledger-devoted">
          <h2 id="ledger-devoted" className="ledger-heading">
            {LEDGER.devotedTitle}
          </h2>
          <p className="ledger-note">{LEDGER.devotedNote}</p>
          {overview.topFaithful.length === 0 ? (
            <p className="ledger-note">{LEDGER.nobody}</p>
          ) : (
            <ol className="ledger-top">
              {overview.topFaithful.map((row, index) => (
                <li key={row.address}>
                  <span className="ledger-place">{ROMAN[index]}</span>
                  <span className="ledger-top-who">
                    <span className="ledger-top-title">{row.title}</span>
                    <JudgeEntryLink
                      address={row.address}
                      label={`${LEDGER.readEntry}: ${shortAddress(row.address)}, ${row.title}`}
                    >
                      {shortAddress(row.address)}
                    </JudgeEntryLink>
                  </span>
                  <span className="ledger-top-amount">
                    {LEDGER.holds} {formatTokensShort(row.balance)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section aria-labelledby="ledger-traitors" className="ledger-tops--red">
          <h2 id="ledger-traitors" className="ledger-heading">
            {LEDGER.traitorsTitle}
          </h2>
          <p className="ledger-note">{LEDGER.traitorsNote}</p>
          {overview.worstTraitors.length === 0 ? (
            <p className="ledger-note">{LEDGER.nobody}</p>
          ) : (
            <ol className="ledger-top">
              {overview.worstTraitors.map((row, index) => (
                <li key={row.address}>
                  <span className="ledger-place">{ROMAN[index]}</span>
                  <span className="ledger-top-who">
                    <span className="ledger-top-title">{row.title}</span>
                    <JudgeEntryLink
                      address={row.address}
                      label={`${LEDGER.readEntry}: ${shortAddress(row.address)}, ${row.title}`}
                    >
                      <span className="codex-struck">
                        {shortAddress(row.address)}
                      </span>
                    </JudgeEntryLink>
                  </span>
                  <span className="ledger-top-amount">
                    {LEDGER.sold}{" "}
                    {row.amount === null ? "?" : formatTokensShort(row.amount)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {demo && <p className="page-note ledger-demo">{LEDGER.demo}</p>}
    </article>
  );
}
