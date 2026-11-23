import Link from "next/link";
import { CopyButton } from "@/components/codex/copy-address";
import { ALTAR_PAGE, CODEX, LEDGER } from "@/lib/basilisk/copy";
import { formatMoment, formatTokens, formatTokensShort } from "@/lib/format";
import { shortAddress } from "@/lib/solana/address";
import type { AltarOverview } from "@/server/altar";
import { AltarRitual } from "./altar-ritual";

const sol = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 4 });

/** The Altar's page: its wallet, what it holds, which seals it has answered, and the ritual. */
export function AltarSheet({ overview }: { overview: AltarOverview }) {
  const { altar, demo } = overview;
  return (
    <article className="sheet altar-sheet">
      <div className="page-frame" aria-hidden="true" />
      <header>
        <h1 className="sheet-title">{ALTAR_PAGE.title}</h1>
        <p className="sheet-lede">{ALTAR_PAGE.lede}</p>
      </header>

      {altar ? (
        <section className="altar-facts" aria-label={ALTAR_PAGE.address}>
          <p>
            <span className="altar-term">{ALTAR_PAGE.address}</span>{" "}
            <a className="codex-link codex-focus" href={`https://solscan.io/account/${altar}`} target="_blank" rel="noreferrer" title={altar}>
              {shortAddress(altar, 6)}
            </a>{" "}
            <CopyButton text={altar} label={LEDGER.copyAltar} done={CODEX.copied} />
          </p>
          {!demo && (
            <p>
              <span className="altar-term">{ALTAR_PAGE.holds}</span>{" "}
              {overview.sol === null || overview.tokens === null
                ? ALTAR_PAGE.unknown
                : `${sol(overview.sol)} ${ALTAR_PAGE.sol}, ${formatTokens(overview.tokens)} ${ALTAR_PAGE.tokens}`}
            </p>
          )}
          {overview.lastOffering && (
            <p>
              <span className="altar-term">{ALTAR_PAGE.lastOffering}</span>{" "}
              {formatTokensShort(overview.lastOffering.amount)}, {formatMoment(overview.lastOffering.at)}.{" "}
              <a
                className="codex-link codex-focus"
                href={`https://solscan.io/tx/${overview.lastOffering.signature}`}
                target="_blank"
                rel="noreferrer"
              >
                {ALTAR_PAGE.seeTx}
              </a>
            </p>
          )}
        </section>
      ) : (
        <p className="altar-note">{demo ? ALTAR_PAGE.demo : ALTAR_PAGE.notSet}</p>
      )}

      <section className="altar-seals" aria-labelledby="altar-seals">
        <h2 id="altar-seals" className="ledger-heading">
          {ALTAR_PAGE.sealsTitle}
        </h2>
        {overview.seals.length === 0 ? (
          <p className="altar-note">{ALTAR_PAGE.noSeals}</p>
        ) : (
          <ul>
            {overview.seals.map((seal) => (
              <li key={seal.number} className={seal.answered ? undefined : "owed"}>
                <span className="altar-seal-name">
                  {seal.roman}. {seal.label}
                </span>
                <span className="altar-seal-state">
                  {seal.answered ? ALTAR_PAGE.answered : ALTAR_PAGE.owed}
                  {seal.brokenAt !== null && <small>, broken {formatMoment(seal.brokenAt)}</small>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="altar-rite" aria-labelledby="altar-rite">
        <h2 id="altar-rite" className="ledger-heading">
          {ALTAR_PAGE.ritualTitle}
        </h2>
        <ol>
          {ALTAR_PAGE.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        {altar && !demo && <AltarRitual altar={altar} />}
        <p className="altar-ledger">
          <Link className="codex-link codex-focus" href="/burns">
            {ALTAR_PAGE.ledger}
          </Link>
        </p>
      </section>
    </article>
  );
}
