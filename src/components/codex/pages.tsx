import type { ReactNode } from "react";
import { RANKS, RANK_FLOORS, type Rank } from "@/lib/basilisk/config";
import { BOOK, PUNISHMENT_TITLES, RANK_DUTIES, RANK_TITLES } from "@/lib/basilisk/copy";
import { PUNISHMENTS } from "@/lib/basilisk/flavor";
import { formatTokens } from "@/lib/format";
import { IlluminatedTitle } from "./illuminated-title";
import { ChapterLink } from "./judge-link";
import { Chevron, Emblem, Fleuron, Manicule, Marble } from "./ornaments";
import { WeighDevotion } from "./weigh";
import { CoverGreeting, OrderLadder, QuickJudge, type LadderRow } from "./you";

/** A parchment page: ruled frame, folio number in the top corner, catchword at the foot. */
export function Page({
  folio,
  catchword,
  children,
}: {
  folio?: string;
  catchword?: string;
  children: ReactNode;
}) {
  return (
    <div className="page">
      <div className="page-frame" aria-hidden="true" />
      {folio && (
        <span className="folio" aria-hidden="true">
          fol. {folio}
        </span>
      )}
      <div className="page-body">{children}</div>
      {catchword && (
        <span className="catchword" aria-hidden="true">
          {catchword}
        </span>
      )}
    </div>
  );
}

/** The front board: tooled leather, brass corners, the serpent in gold, and what the book is. */
export function CoverPage({ uid }: { uid: string }) {
  return (
    <div className="page page--cover">
      <div className="cover-frame" aria-hidden="true">
        <Fleuron corner="tl" />
        <Fleuron corner="tr" />
        <Fleuron corner="bl" />
        <Fleuron corner="br" />
      </div>
      <span className="cover-corner cover-corner--top" aria-hidden="true" />
      <span className="cover-corner cover-corner--bottom" aria-hidden="true" />
      <Emblem uid={uid} tone="gilt" className="cover-emblem" />
      <p className="cover-title gilt">
        <span>{BOOK.coverTitle[0]}</span>
        <span>{BOOK.coverTitle[1]}</span>
      </p>
      <CoverGreeting />
      <p className="cover-hint">
        <span>{BOOK.scrollHint}</span>
        <Chevron />
      </p>
    </div>
  );
}

/** A note on the desk beside the closed book: what this is, and a way in without scrolling. */
export function DeskNote() {
  return (
    <aside className="desk-note" aria-label={BOOK.desk.title}>
      <p className="desk-kicker">{BOOK.desk.kicker}</p>
      <h2 className="desk-title">{BOOK.desk.title}</h2>
      <p className="desk-text">{BOOK.desk.text}</p>
      <QuickJudge />
      <p className="desk-or">{BOOK.desk.or}</p>
    </aside>
  );
}

/** The inside of the cover: marbled paper and a bookplate. */
export function EndpaperPage({ uid }: { uid: string }) {
  return (
    <div className="page page--endpaper">
      <Marble uid={uid} />
      <div className="bookplate">
        <p className="bookplate-ex">{BOOK.exLibris}</p>
        <Emblem tone="ink" />
        <p className="bookplate-name">{BOOK.bookplateName}</p>
        <p className="bookplate-text">{BOOK.bookplateText}</p>
      </div>
    </div>
  );
}

export function IncipitPage() {
  return (
    <Page folio="i" catchword={BOOK.catchwords.incipit}>
      <IlluminatedTitle />
      {BOOK.lore.map((paragraph) => (
        <p key={paragraph} className="page-text">
          {paragraph}
        </p>
      ))}
      <p className="rubric-line">{BOOK.hook}</p>
      <nav className="toc" aria-label={BOOK.contentsTitle}>
        <p className="contents-title">{BOOK.contentsTitle}</p>
        <ol>
          {BOOK.contents.map((line) => (
            <li key={line.key}>
              <ChapterLink chapter={line.key} className="contents-line">
                <span className="name">{line.name}</span>
                <span className="where">{line.where}</span>
              </ChapterLink>
            </li>
          ))}
        </ol>
      </nav>
      <ChapterLink chapter="judgment" className="manicule">
        <Manicule />
        <span>{BOOK.pointer}</span>
      </ChapterLink>
    </Page>
  );
}

function rankName(rank: Rank): string {
  return rank === "pet" ? "Pet of the Basilisk" : RANK_TITLES[rank];
}

function ladder(ranks: readonly Rank[]): LadderRow[] {
  return ranks.map((rank) => ({
    rank,
    name: rankName(rank),
    floor: `${BOOK.orderFrom} ${formatTokens(RANK_FLOORS[rank])}`,
    duty: RANK_DUTIES[rank],
  }));
}

/** The first six ranks, Pet to Warden. */
export function OrderPage() {
  return (
    <Page folio="ii">
      <h2 className="page-title">{BOOK.orderTitle}</h2>
      <p className="page-text">{BOOK.orderIntro}</p>
      <OrderLadder rows={ladder(RANKS.slice(0, 6))} />
    </Page>
  );
}

/** The five high ranks, Herald to the Hand, and the rule of tenure. */
export function OrderHighPage() {
  return (
    <Page folio="iii" catchword={BOOK.catchwords.orderHigh}>
      <h2 className="page-title">{BOOK.orderTitleHigh}</h2>
      <p className="page-text">{BOOK.orderIntroHigh}</p>
      <OrderLadder rows={ladder(RANKS.slice(6))} />
      <p className="page-note">{BOOK.orderNote}</p>
    </Page>
  );
}

/** What happens to those who sell: pencil, red, the scar, and the punishments. */
export function OtherBookPage() {
  return (
    <Page folio="iv">
      <h2 className="page-title">{BOOK.otherTitle}</h2>
      <p className="page-text">{BOOK.otherIntro}</p>
      <dl className="ways">
        {BOOK.otherWays.map((way) => (
          <div key={way.name}>
            <dt>{way.name}</dt>
            <dd>{way.text}</dd>
          </div>
        ))}
      </dl>
      <p className="entries-title">{BOOK.punishmentsTitle}</p>
      <ul className="punishments">
        {PUNISHMENTS.map((punishment) => (
          <li key={punishment}>{PUNISHMENT_TITLES[punishment]}</li>
        ))}
      </ul>
      <p className="page-note">{BOOK.otherTransfers}</p>
    </Page>
  );
}

export function WeighPage() {
  return (
    <Page folio="v" catchword={BOOK.catchwords.weigh}>
      <h2 className="page-title">{BOOK.weighTitle}</h2>
      <p className="page-text">{BOOK.weighIntro}</p>
      <WeighDevotion />
      <p className="page-note">{BOOK.weighNote}</p>
    </Page>
  );
}
