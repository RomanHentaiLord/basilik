import type { CSSProperties } from "react";
import { BOOK, CODEX } from "@/lib/basilisk/copy";
import { SEALS, sealMark, type Seal } from "@/lib/basilisk/seals";
import { formatMoment, formatUsd } from "@/lib/format";
import type { sealsOverview } from "@/server/basilisk";
import { Page } from "./pages";
import { SealReading, SealsGrid, type SealView } from "./seal-reader";

export type SealsOverview = Awaited<ReturnType<typeof sealsOverview>>;

const percent = (share: number) => `${Math.round(share * 100)}%`;

function when(seal: Seal): string {
  return seal.trigger.kind === "bond" ? "at the bond, when the curve is full" : `at ${percent(seal.trigger.progress)} of the bonding curve`;
}

function views(overview: SealsOverview): SealView[] {
  const next = overview.next?.seal.number ?? null;
  return overview.seals.map((seal) => ({
    number: seal.number,
    roman: seal.roman,
    label: seal.label,
    unlock: seal.unlock,
    when: when(seal),
    mark: sealMark(seal),
    broken: seal.broken,
    isNext: seal.number === next,
    words: seal.words,
    brokenOn: seal.brokenAt === null ? null : `${BOOK.sealBrokenOn} ${formatMoment(seal.brokenAt)}`,
  }));
}

/** The seal opened by default: the latest broken one, or the first. */
function fallbackSeal(overview: SealsOverview): number {
  return overview.broken > 0 ? overview.broken : 1;
}

/** The whole bonding curve as one bar, with a notch where each seal breaks. */
export function CurveBar({ curve }: { curve: number }) {
  return (
    <div className="ink-bar curve-bar" aria-hidden="true">
      <span style={{ "--p": percent(curve) } as CSSProperties} />
      {SEALS.filter((seal) => seal.trigger.kind === "curve").map((seal) => (
        <i key={seal.number} className="curve-notch" style={{ left: percent(sealMark(seal)) }} />
      ))}
    </div>
  );
}

/** Left page: the seven seals and how far up the bonding curve the coin is. */
export function SealsPage({ overview }: { overview: SealsOverview }) {
  const next = overview.next;
  return (
    <Page folio="vi">
      <h2 className="page-title">{CODEX.sealsTitle}</h2>
      <p className="page-text">{BOOK.sealsIntro}</p>
      <SealsGrid seals={views(overview)} fallback={fallbackSeal(overview)} />
      {overview.graduated ? <TrumpetsBox overview={overview} /> : null}
      <div className="mcap" hidden={overview.graduated}>
        <div className="mcap-row">
          <span>{BOOK.curveNow}</span>
          <strong>
            {overview.graduated ? BOOK.bonded : overview.curve === null ? BOOK.mcapUnknown : percent(overview.curve)}
          </strong>
        </div>
        {overview.curve !== null && <CurveBar curve={overview.curve} />}
        <div className="mcap-row">
          <span>{BOOK.mcapNow}</span>
          <span>{overview.source === "none" ? BOOK.mcapUnknown : formatUsd(overview.mcapUsd)}</span>
        </div>
        {next && (
          <p className="mcap-to" style={{ margin: "0.3em 0 0" }}>
            {BOOK.sealNames[next.seal.number]} breaks {when(next.seal)}
          </p>
        )}
      </div>
    </Page>
  );
}

/** After the bond: how many trumpets have sounded and how far the next one is. */
function TrumpetsBox({ overview }: { overview: SealsOverview }) {
  const { sounded, next } = overview.trumpets;
  return (
    <div className="mcap">
      <div className="mcap-row">
        <span>{BOOK.trumpetsNow}</span>
        <strong>
          {sounded} {BOOK.ofSeven}
        </strong>
      </div>
      {next && (
        <div className="ink-bar" aria-hidden="true">
          <span style={{ "--p": percent(next.progress) } as CSSProperties} />
        </div>
      )}
      <div className="mcap-row">
        <span>{BOOK.mcapNow}</span>
        <span>{overview.source === "none" ? BOOK.mcapUnknown : formatUsd(overview.mcapUsd)}</span>
      </div>
      <p className="mcap-to" style={{ margin: "0.3em 0 0" }}>
        {next ? BOOK.trumpetNext(next.trumpet.roman, formatUsd(next.trumpet.mcapUsd)) : BOOK.trumpetsDone}
      </p>
    </div>
  );
}

/** Right page: the seal you touched, read aloud. */
export function ReadingPage({ overview }: { overview: SealsOverview }) {
  return (
    <Page folio="vii" catchword={BOOK.catchwords.reading}>
      <SealReading seals={views(overview)} fallback={fallbackSeal(overview)} curve={overview.curve} />
    </Page>
  );
}
