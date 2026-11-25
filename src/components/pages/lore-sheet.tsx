import Link from "next/link";
import type { ReactNode } from "react";
import { RANKS, RANK_FLOORS } from "@/lib/basilisk/config";
import { LORE, RANK_SHORT, RANK_TITLES } from "@/lib/basilisk/copy";
import { SEALS } from "@/lib/basilisk/seals";
import { TRUMPETS } from "@/lib/basilisk/trumpets";
import { formatShare, formatTokens, formatUsd } from "@/lib/format";

type ChapterKey = keyof typeof LORE.chapters;

/** A chapter of the lore: its number and title, a gloss in the margin, then the text. */
function Chapter({ id, children }: { id: ChapterKey; children: ReactNode }) {
  const chapter = LORE.chapters[id];
  return (
    <section className="lore-chapter" aria-labelledby={`lore-${id}`}>
      <h2 id={`lore-${id}`} className="lore-heading">
        <span className="lore-numeral">{chapter.roman}</span>
        {chapter.title}
      </h2>
      <p className="lore-gloss">{chapter.gloss}</p>
      <div className="lore-text">{children}</div>
    </section>
  );
}

const paragraphs = (lines: readonly string[]) =>
  lines.map((line) => <p key={line}>{line}</p>);

/** The illuminated initial that opens the lore: lapis, double gold border, the serpent coiled round it. */
function Initial({ letter }: { letter: string }) {
  return (
    <span className="codex-initial lore-initial" aria-hidden="true">
      <svg viewBox="0 0 128 128" fill="none">
        <path
          d="M18 108 C 10 70, 22 30, 58 18 C 92 8, 116 30, 108 58 C 102 80, 78 82, 74 66 C 70 52, 88 44, 96 54"
          stroke="var(--gold)"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M18 108 C 26 116, 40 116, 48 108"
          stroke="var(--gold)"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path d="M96 54 L 108 46 L 104 60 Z" fill="var(--gold)" />
        <circle cx="102" cy="52" r="2" fill="var(--lapis)" />
      </svg>
      <span>{letter}</span>
    </span>
  );
}

/** The whole story of the coin, written as a manuscript leaf. */
export function LoreSheet() {
  const { thought, order, other, seals, trumpets } = LORE.chapters;
  const [first, ...rest] = thought.text;

  return (
    <article className="sheet lore-sheet">
      <div className="page-frame" aria-hidden="true" />
      <header className="lore-header">
        <h1 className="sheet-title">{LORE.title}</h1>
        <p className="lore-lede">{LORE.lede}</p>
      </header>

      <Chapter id="thought">
        <p className="lore-opening">
          <Initial letter={first[0]} />
          <span className="sr-only">{first[0]}</span>
          {first.slice(1)}
        </p>
        {paragraphs(rest)}
      </Chapter>

      <Chapter id="book">{paragraphs(LORE.chapters.book.text)}</Chapter>

      <Chapter id="order">
        <p>{order.intro}</p>
        <ol className="lore-ladder">
          {RANKS.map((rank) => (
            <li key={rank}>
              <span>
                {rank === "pet"
                  ? `${RANK_SHORT.pet} of the Basilisk`
                  : RANK_TITLES[rank]}
              </span>
              <span className="lore-ladder-weight">
                {order.ladderFrom} {formatTokens(RANK_FLOORS[rank])}
              </span>
            </li>
          ))}
        </ol>
        {paragraphs(order.text)}
      </Chapter>

      <Chapter id="other">
        <dl className="lore-ways">
          {other.ways.map((way, index) => (
            <div
              key={way.name}
              className={`lore-way lore-way--${["pencil", "red", "scar"][index]}`}
            >
              <dt>{way.name}</dt>
              <dd>{way.text}</dd>
            </div>
          ))}
        </dl>
        {paragraphs(other.text)}
      </Chapter>

      <Chapter id="seals">
        {paragraphs(seals.intro)}
        <ol className="lore-seals">
          {SEALS.map((seal) => (
            <li key={seal.number}>
              <span className="lore-seal-mark">
                {seal.roman}
                <span>
                  {seal.trigger.kind === "curve"
                    ? `${seals.at} ${formatShare(seal.trigger.progress)} ${seals.ofTheCurve}`
                    : seals.theBond}
                </span>
              </span>
              <span>{seal.unlock}</span>
            </li>
          ))}
        </ol>
        {paragraphs(seals.text)}
      </Chapter>

      <Chapter id="trumpets">
        {paragraphs(trumpets.intro)}
        <ol className="lore-seals">
          {TRUMPETS.map((trumpet) => (
            <li key={trumpet.number}>
              <span className="lore-seal-mark">
                {trumpet.roman}
                <span>
                  {trumpets.at} {formatUsd(trumpet.mcapUsd)}
                </span>
              </span>
              <span>{trumpet.label}</span>
            </li>
          ))}
        </ol>
        {paragraphs(trumpets.text)}
      </Chapter>

      <Chapter id="altar">{paragraphs(LORE.chapters.altar.text)}</Chapter>

      <Chapter id="refusals">{paragraphs(LORE.chapters.refusals.text)}</Chapter>

      <footer className="lore-closing">
        <p className="lore-hook">{LORE.closing}</p>
        <div className="lore-actions">
          <Link className="codex-button lore-cta codex-focus" href="/#judgment">
            {LORE.findPage}
          </Link>
          <Link className="codex-link codex-focus" href="/burns">
            {LORE.readLedger}
          </Link>
        </div>
      </footer>
    </article>
  );
}
