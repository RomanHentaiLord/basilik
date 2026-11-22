import { JUDGMENT } from "@/lib/basilisk/copy";
import { Emblem } from "./ornaments";
import { Ribbon } from "./ribbon";
import { WhoAmI } from "./you";

/** The bar over the desk: the name, the X account, "Who am I?" (or your rank), and the contract ribbon. */
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
        <WhoAmI />
        <Ribbon mint={mint} />
      </nav>
    </header>
  );
}
