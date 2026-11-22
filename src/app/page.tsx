import { FaithfulPage, TraitorsPage } from "@/components/codex/books";
import { FlipBook, type Chapter, type LeafSpec } from "@/components/codex/flip-book";
import { JudgmentSection } from "@/components/codex/judgment";
import {
  CoverPage,
  DeskNote,
  EndpaperPage,
  IncipitPage,
  OrderHighPage,
  OrderPage,
  OtherBookPage,
  WeighPage,
} from "@/components/codex/pages";
import { ReadingPage, SealsPage } from "@/components/codex/seals";
import { SiteHeader } from "@/components/codex/site-header";
import { TraitorFeed } from "@/components/codex/traitor-feed";
import { BOOK, JUDGMENT } from "@/lib/basilisk/copy";
import { sealsOverview, tokenMint } from "@/server/basilisk";
import { booksOverview } from "@/server/books";

/**
 * The Codex. A closed book on a desk; scrolling opens it and turns its pages:
 * the incipit, the Order of the Faithful, the Other Book, the seven seals, the two Books.
 * After the last page comes "Your page", where a wallet is judged.
 *
 * The book is laid out twice, as two-page spreads (wide screens) and as single
 * pages (phones); CSS shows the one that fits.
 */
export default async function Home() {
  const [seals, books] = await Promise.all([sealsOverview(), booksOverview()]);
  const mint = tokenMint();

  const pages = (uid: string) => ({
    cover: <CoverPage uid={uid} />,
    endpaper: <EndpaperPage uid={uid} />,
    incipit: <IncipitPage />,
    order: <OrderPage />,
    orderHigh: <OrderHighPage />,
    other: <OtherBookPage />,
    weigh: <WeighPage />,
    seals: <SealsPage overview={seals} />,
    reading: <ReadingPage overview={seals} />,
    faithful: <FaithfulPage books={books} />,
    traitors: <TraitorsPage books={books} />,
  });

  const wide = pages("wide");
  const spreadLeaves: LeafSpec[] = [
    { front: wide.cover, back: wide.endpaper, cover: true },
    { front: wide.incipit, back: wide.order },
    { front: wide.orderHigh, back: wide.other },
    { front: wide.weigh, back: wide.seals },
    { front: wide.reading, back: wide.faithful },
  ];

  // Phones skip the endpaper: one page fewer to scroll.
  const narrow = pages("narrow");
  const singleLeaves: LeafSpec[] = [
    narrow.cover,
    narrow.incipit,
    narrow.order,
    narrow.orderHigh,
    narrow.other,
    narrow.weigh,
    narrow.seals,
    narrow.reading,
    narrow.faithful,
  ].map((page, index) => ({ front: page, back: null, cover: index === 0 }));

  // Where each line of the table of contents opens, in each layout.
  const spreadChapters = { order: 2, other: 3, weigh: 3, seals: 4, faithful: 5, traitors: 5 };
  const singleChapters = { order: 2, other: 4, weigh: 5, seals: 6, faithful: 8, traitors: 9 };

  const chapters: Chapter[] = [
    ...BOOK.chapters.map((chapter, index) => ({ ...chapter, spread: index + 1 })),
    { roman: "VI", title: JUDGMENT.title, href: "#judgment" },
  ];

  return (
    <>
      <SiteHeader mint={mint} />
      <main id="top">
        <FlipBook
          mode="spread"
          label={BOOK.label}
          leaves={spreadLeaves}
          base={wide.traitors}
          chapters={chapters}
          chapterSpreads={spreadChapters}
          aside={<DeskNote />}
        />
        <FlipBook
          mode="single"
          label={BOOK.label}
          leaves={singleLeaves}
          base={narrow.traitors}
          chapterSpreads={singleChapters}
        />
        <JudgmentSection sealsBroken={seals.broken} mint={mint} />
      </main>
      <TraitorFeed />
    </>
  );
}
