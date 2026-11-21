import { Suspense } from "react";
import { TraitorsSection, Tally, TallySkeleton } from "@/components/codex/books";
import { Colophon } from "@/components/codex/colophon";
import { IlluminatedTitle } from "@/components/codex/illuminated-title";
import { JudgePanel } from "@/components/codex/judge-panel";
import { Ribbon } from "@/components/codex/ribbon";
import { SealsSection, SealsSkeleton } from "@/components/codex/seals";
import { CODEX } from "@/lib/basilisk/copy";
import { tokenMint } from "@/server/basilisk";

/** The Codex: an open book. Left page judges your wallet; right page holds the seals and the traitors. */
export default function Home() {
  const mint = tokenMint();

  return (
    <main className="codex-desk">
      <div className="codex-book">
        <Ribbon mint={mint} />

        <section className="codex-page codex-page--left" aria-label="The Book of the Basilisk">
          <IlluminatedTitle />
          <p className="mt-[26px] mb-[30px] max-w-[30em] text-[22px] leading-normal">{CODEX.lede}</p>
          <JudgePanel />
          <Suspense fallback={<TallySkeleton />}>
            <Tally />
          </Suspense>
        </section>

        <section className="codex-page codex-page--right" aria-label="The seals and the Book of Traitors">
          <Suspense fallback={<SealsSkeleton />}>
            <SealsSection />
          </Suspense>
          <Suspense fallback={null}>
            <TraitorsSection />
          </Suspense>
        </section>
      </div>

      <Colophon mint={mint} />
    </main>
  );
}
