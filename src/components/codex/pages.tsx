import type { ReactNode } from "react";
import { RANKS, type Rank } from "@/lib/basilisk/config";
import { BOOK, RANK_FATES, RANK_TITLES } from "@/lib/basilisk/copy";
import { IlluminatedTitle } from "./illuminated-title";
import { ChapterLink } from "./judge-link";
import { Chevron, Emblem, Fleuron, Manicule, Marble } from "./ornaments";
import { WeighDevotion } from "./weigh";

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

/** The front board: tooled leather, brass corners, the serpent in gold. */
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
      <p className="cover-sub">{BOOK.coverSub}</p>
      <p className="cover-hint">
        <span>{BOOK.scrollHint}</span>
        <Chevron />
      </p>
    </div>
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

export function OrderPage() {
  const ladder = [...RANKS].reverse();
  return (
    <Page folio="ii">
      <h2 className="page-title">{BOOK.orderTitle}</h2>
      <p className="page-text">{BOOK.orderIntro}</p>
      <ul className="order-list">
        {ladder.map((rank) => (
          <li key={rank}>
            <div className="order-head">
              <span className="order-name">{rankName(rank)}</span>
              <span className="order-floor">{BOOK.orderFloor[rank]}</span>
            </div>
            <p className="order-fate">{RANK_FATES[rank]}</p>
          </li>
        ))}
      </ul>
      <p className="page-note">{BOOK.orderNote}</p>
    </Page>
  );
}

export function WeighPage() {
  return (
    <Page folio="iii" catchword={BOOK.catchwords.weigh}>
      <h2 className="page-title">{BOOK.weighTitle}</h2>
      <p className="page-text">{BOOK.weighIntro}</p>
      <WeighDevotion />
      <p className="page-note">{BOOK.weighNote}</p>
    </Page>
  );
}
