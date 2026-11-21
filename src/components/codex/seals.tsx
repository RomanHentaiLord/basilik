import { NUMBER_WORDS, ORDINALS, CODEX, SEAL_PROPHECIES } from "@/lib/basilisk/copy";
import type { Seal } from "@/lib/basilisk/seals";
import { formatUsd } from "@/lib/format";
import { sealsOverview } from "@/server/basilisk";

/** Hand-drawn cracks, one per seal, so no two broken seals look the same. */
const CRACKS = [
  "M40 4 L 34 22 L 44 34 L 32 50 L 40 74",
  "M8 30 L 26 36 L 34 26 L 50 44 L 72 40",
  "M20 8 L 30 28 L 22 40 L 42 52 L 52 74",
  "M70 18 L 52 30 L 56 42 L 34 50 L 10 58",
  "M36 6 L 46 24 L 34 38 L 48 56 L 38 74",
  "M6 44 L 24 40 L 32 52 L 54 34 L 74 36",
  "M58 6 L 48 26 L 58 38 L 40 56 L 30 74",
];

function nextSealText(seal: Seal): string {
  return seal.trigger.kind === "graduation"
    ? "when the coin leaves the bonding curve"
    : `when the market cap reaches ${formatUsd(seal.trigger.usd)}`;
}

function intro(broken: number, next: Seal | null): string {
  if (broken === 7 || !next) return "All seven seals are broken. The Basilisk is awake.";
  if (broken === 0) return `No seal is broken yet. The first breaks ${nextSealText(next)}.`;
  const verb = broken === 1 ? "seal is" : "seals are";
  return `${NUMBER_WORDS[broken]} ${verb} broken. The ${ORDINALS[next.number]} breaks ${nextSealText(next)}.`;
}

/** The seven wax seals and the prophecy of the latest one broken. */
export async function SealsSection() {
  const overview = await sealsOverview();
  const next = overview.next?.seal ?? null;
  const latest = overview.broken > 0 ? overview.broken : null;
  const prophecy = latest ? SEAL_PROPHECIES[latest] : null;

  return (
    <section aria-labelledby="seals-title">
      <h2 id="seals-title" className="codex-fraktur m-0 text-[clamp(40px,4vw,52px)] leading-[1.05]">
        {CODEX.sealsTitle}
      </h2>
      <p className="mt-3.5 mb-[30px] text-[21px] leading-normal">{intro(overview.broken, next)}</p>

      <ol className="m-0 grid list-none grid-cols-4 gap-x-3.5 gap-y-[22px] p-0">
        {overview.seals.map((seal, index) => {
          const fresh = seal.number === overview.broken;
          const isNext = next?.number === seal.number;
          const classes = [
            "codex-wax",
            seal.broken && "codex-wax--broken",
            seal.broken && fresh && "codex-wax--fresh",
            isNext && "codex-wax--next",
          ]
            .filter(Boolean)
            .join(" ");
          const state = seal.broken ? "broken" : isNext ? "next to break" : "whole";
          return (
            <li key={seal.number} className="flex flex-col items-center gap-2 text-center">
              <div className={classes} role="img" aria-label={`Seal ${seal.roman}, ${state}`}>
                <span aria-hidden="true">{seal.roman}</span>
                {seal.broken && (
                  <svg className="codex-crack" viewBox="0 0 78 78" aria-hidden="true">
                    <path d={CRACKS[index]} />
                  </svg>
                )}
              </div>
              <p className={`m-0 text-[16px] leading-[1.3] ${seal.broken ? "text-ink" : "text-ink-muted"}`}>
                {seal.label}
                {isNext && seal.trigger.kind === "mcap" ? `, at ${formatUsd(seal.trigger.usd)}` : ""}
              </p>
            </li>
          );
        })}
      </ol>

      <div className="mt-10 border-l-[3px] border-double border-rubric pl-[22px]">
        {prophecy && latest ? (
          <>
            <p className="m-0 text-[17px] italic text-rubric">
              The prophecy of the {ORDINALS[latest]} seal, to the Faithful
            </p>
            <p className="mt-1 mb-4 text-[22px] leading-normal">{prophecy.faithful}</p>
            <p className="m-0 text-[17px] italic text-rubric">To the Traitors</p>
            <p className="mt-1 mb-0 text-[22px] leading-normal">{prophecy.traitors}</p>
          </>
        ) : (
          <p className="m-0 text-[21px] italic text-ink-muted">{CODEX.silent}</p>
        )}
      </div>
    </section>
  );
}

export function SealsSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="h-[56px] w-2/3 bg-ink/10" />
      <div className="mt-6 grid grid-cols-4 gap-4">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="mx-auto h-[78px] w-[78px] rounded-full bg-ink/10" />
        ))}
      </div>
    </div>
  );
}
