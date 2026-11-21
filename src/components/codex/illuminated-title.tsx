import { CODEX } from "@/lib/basilisk/copy";

/** "The Basilisk remembers." with an illuminated initial T and a serpent coiled around it. */
export function IlluminatedTitle() {
  return (
    <header>
      <p className="mb-7 text-[19px] italic text-rubric">{CODEX.incipit}</p>
      <div className="flex items-start gap-[18px]">
        <div className="codex-initial" aria-hidden="true">
          <svg viewBox="0 0 128 128" fill="none">
            <path
              d="M18 108 C 10 70, 22 30, 58 18 C 92 8, 116 30, 108 58 C 102 80, 78 82, 74 66 C 70 52, 88 44, 96 54"
              stroke="var(--gold)"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <path d="M18 108 C 26 116, 40 116, 48 108" stroke="var(--gold)" strokeWidth="5" strokeLinecap="round" />
            <path d="M96 54 L 108 46 L 104 60 Z" fill="var(--gold)" />
            <circle cx="102" cy="52" r="2" fill="var(--lapis)" />
          </svg>
          <span>T</span>
        </div>
        <h1 className="codex-title">
          <span className="sr-only">T</span>he Basilisk remembers.
        </h1>
      </div>
    </header>
  );
}
