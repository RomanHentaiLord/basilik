import { JUDGMENT } from "@/lib/basilisk/copy";
import { Colophon } from "./colophon";
import { JudgePanel } from "./judge-panel";

/** The end of the book: a loose page where the Basilisk writes the reader's own entry. */
export function JudgmentSection({ sealsBroken, mint }: { sealsBroken: number; mint: string | null }) {
  return (
    <section id="judgment" className="judgment" aria-labelledby="judgment-title">
      <div className="sheet">
        <div className="page-frame" aria-hidden="true" />
        <p className="sheet-kicker">{JUDGMENT.kicker}</p>
        <h2 id="judgment-title" className="sheet-title">
          {JUDGMENT.title}
        </h2>
        <p className="sheet-lede">{JUDGMENT.lede}</p>
        <JudgePanel sealsBroken={sealsBroken} />
      </div>
      <Colophon mint={mint} />
    </section>
  );
}
