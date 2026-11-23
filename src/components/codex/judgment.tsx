import { BOOK, JUDGMENT } from "@/lib/basilisk/copy";
import { formatDay } from "@/lib/format";
import { Colophon } from "./colophon";
import { JudgePanel } from "./judge-panel";

/** The end of the book: a loose page where the Basilisk writes the reader's own entry. */
export function JudgmentSection({
  sealsBroken,
  mint,
  psalm,
}: {
  sealsBroken: number;
  mint: string | null;
  /** Today's psalm, once the first seal is broken. */
  psalm: { day: string; text: string } | null;
}) {
  return (
    <section id="judgment" className="judgment" aria-labelledby="judgment-title">
      <div className="sheet">
        <div className="page-frame" aria-hidden="true" />
        <p className="sheet-kicker">{JUDGMENT.kicker}</p>
        <h2 id="judgment-title" className="sheet-title">
          {JUDGMENT.title}
        </h2>
        <p className="sheet-lede">{JUDGMENT.lede}</p>
        {psalm && <PsalmOfTheDay psalm={psalm} />}
        <JudgePanel sealsBroken={sealsBroken} />
      </div>
      <Colophon mint={mint} />
    </section>
  );
}

/** The verse it speaks each day from the first seal on. */
export function PsalmOfTheDay({ psalm }: { psalm: { day: string; text: string } }) {
  return (
    <figure className="psalm">
      <figcaption>{BOOK.psalmOf(formatDay(Date.parse(psalm.day)))}</figcaption>
      <blockquote>{psalm.text}</blockquote>
    </figure>
  );
}
