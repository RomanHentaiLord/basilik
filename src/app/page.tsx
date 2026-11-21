import { Suspense } from "react";
import { SITE } from "@/lib/basilisk/copy";
import { sealsOverview } from "@/server/basilisk";
import { JudgeForm } from "./judge-form";

/**
 * Working prototype of the home page: the judge works end to end (demo mode until launch).
 * The visual design will be rebuilt once a direction is chosen.
 */

async function SealsStrip() {
  const overview = await sealsOverview();
  const usd = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
  });

  return (
    <section className="w-full max-w-xl">
      <ol className="grid grid-cols-7 gap-2">
        {overview.seals.map((seal) => (
          <li
            key={seal.number}
            title={seal.unlock}
            className={`rounded-lg border py-2 text-center font-mono text-sm ${
              seal.broken
                ? "border-accent/70 text-accent"
                : "border-white/10 text-muted"
            }`}
          >
            {seal.roman}
          </li>
        ))}
      </ol>
      {overview.next && (
        <div className="mt-4">
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-accent"
              style={{ width: `${Math.round(overview.next.progress * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted">
            Market cap {usd.format(overview.mcapUsd)} · next: seal {overview.next.seal.roman} —{" "}
            {overview.next.seal.unlock}
            {overview.demo ? " (demo)" : ""}
          </p>
        </div>
      )}
    </section>
  );
}

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-12 px-6 py-24">
      <header className="text-center">
        <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">{SITE.title}</h1>
        <p className="mt-4 text-lg text-muted">{SITE.subtitle}</p>
      </header>

      <JudgeForm />

      <Suspense fallback={<div className="h-16 w-full max-w-xl" />}>
        <SealsStrip />
      </Suspense>
    </main>
  );
}
