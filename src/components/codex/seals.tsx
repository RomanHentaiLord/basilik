import type { CSSProperties } from "react";
import { BOOK, CODEX } from "@/lib/basilisk/copy";
import type { Seal } from "@/lib/basilisk/seals";
import { formatUsd } from "@/lib/format";
import type { sealsOverview } from "@/server/basilisk";
import { Page } from "./pages";
import { SealReading, SealsGrid, type SealView } from "./seal-reader";

export type SealsOverview = Awaited<ReturnType<typeof sealsOverview>>;

function when(seal: Seal): string {
  return seal.trigger.kind === "graduation" ? "when the coin leaves the bonding curve" : `at ${formatUsd(seal.trigger.usd)}`;
}

function views(overview: SealsOverview): SealView[] {
  const next = overview.next?.seal.number ?? null;
  return overview.seals.map((seal) => ({
    number: seal.number,
    roman: seal.roman,
    label: seal.label,
    unlock: seal.unlock,
    when: when(seal),
    usd: seal.trigger.kind === "mcap" ? seal.trigger.usd : null,
    broken: seal.broken,
    isNext: seal.number === next,
  }));
}

/** The seal opened by default: the latest broken one, or the first. */
function fallbackSeal(overview: SealsOverview): number {
  return overview.broken > 0 ? overview.broken : 1;
}

/** Left page: the seven seals and how far the market is from the next one. */
export function SealsPage({ overview }: { overview: SealsOverview }) {
  const next = overview.next;
  return (
    <Page folio="vi">
      <h2 className="page-title">{CODEX.sealsTitle}</h2>
      <p className="page-text">{BOOK.sealsIntro}</p>
      <SealsGrid seals={views(overview)} fallback={fallbackSeal(overview)} />
      <div className="mcap">
        <div className="mcap-row">
          <span>{BOOK.mcapNow}</span>
          <strong>{overview.source === "none" ? BOOK.mcapUnknown : formatUsd(overview.mcapUsd)}</strong>
        </div>
        {next && overview.source !== "none" && (
          <>
            <div className="ink-bar" aria-hidden="true">
              <span style={{ "--p": `${Math.round(next.progress * 100)}%` } as CSSProperties} />
            </div>
            <p className="mcap-to" style={{ margin: 0 }}>
              {BOOK.sealNames[next.seal.number]} breaks {when(next.seal)}
            </p>
          </>
        )}
      </div>
    </Page>
  );
}

/** Right page: the seal you touched, read aloud. */
export function ReadingPage({ overview }: { overview: SealsOverview }) {
  return (
    <Page folio="vii" catchword={BOOK.catchwords.reading}>
      <SealReading
        seals={views(overview)}
        fallback={fallbackSeal(overview)}
        mcapUsd={overview.source === "none" ? null : overview.mcapUsd}
      />
    </Page>
  );
}
