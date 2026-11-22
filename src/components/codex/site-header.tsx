import { JUDGMENT } from "@/lib/basilisk/copy";
import { Emblem } from "./ornaments";
import { Ribbon } from "./ribbon";

/** The bar over the desk: the name, the X account, a shortcut to your page, and the contract ribbon. */
export function SiteHeader({ mint }: { mint: string | null }) {
  const x = process.env.NEXT_PUBLIC_X_URL?.trim() || null;
  const words = JUDGMENT.header;

  return (
    <header className="site-header">
      <a href="#top" className="brand codex-focus" aria-label="The Basilisk, back to the cover">
        <Emblem tone="gold" />
        <span className="brand-name">The Basilisk</span>
      </a>
      <nav className="header-actions" aria-label="The coin">
        {x ? (
          <a className="header-x codex-focus" href={x} target="_blank" rel="noreferrer">
            <span className="long">Follow on&nbsp;</span>X
          </a>
        ) : (
          <span className="header-x header-x--soon" title={words.xSoon} aria-label={`X: ${words.xSoon}`}>
            <span className="long">Follow on&nbsp;</span>X
          </span>
        )}
        <a className="header-cta codex-focus" href="#judgment">
          <span className="long">{words.findPage}</span>
          <span className="short">{words.findPageShort}</span>
        </a>
        <Ribbon mint={mint} />
      </nav>
    </header>
  );
}
