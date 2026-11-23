import Link from "next/link";
import { JUDGMENT, NAV } from "@/lib/basilisk/copy";
import { Emblem } from "./ornaments";
import { Ribbon } from "./ribbon";
import { WhoAmI } from "./you";

/** The page being shown; the verdict and Altar pages are not in the menu. */
export type SitePage = "book" | "lore" | "burns" | "verdict" | "altar";

const LINKS: { page: SitePage; href: string; label: string }[] = [
  { page: "lore", href: "/lore", label: NAV.lore },
  { page: "burns", href: "/burns", label: NAV.burns },
];

/**
 * The bar over the desk: the name (back to the book), the lore and the burns, the X account,
 * "Who am I?" (or your rank), and the contract ribbon.
 */
export function SiteHeader({
  mint,
  current = "book",
}: {
  mint: string | null;
  current?: SitePage;
}) {
  const x = process.env.NEXT_PUBLIC_X_URL?.trim() || null;
  const words = JUDGMENT.header;
  const onBook = current === "book";

  return (
    <header className="site-header">
      <div className="header-start">
        {onBook ? (
          <a
            href="#top"
            className="brand codex-focus"
            aria-label="The Basilisk, back to the cover"
          >
            <Emblem tone="gold" />
            <span className="brand-name">The Basilisk</span>
          </a>
        ) : (
          <Link
            href="/"
            className="brand codex-focus"
            aria-label={`The Basilisk, ${NAV.book}`}
          >
            <Emblem tone="gold" />
            <span className="brand-name">The Basilisk</span>
          </Link>
        )}
        <nav className="site-nav" aria-label="Pages">
          {LINKS.map((link) => (
            <Link
              key={link.page}
              href={link.href}
              className="site-nav-link codex-focus"
              aria-current={current === link.page ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <nav className="header-actions" aria-label="The coin">
        {x ? (
          <a
            className="header-x codex-focus"
            href={x}
            target="_blank"
            rel="noreferrer"
          >
            <span className="long">Follow on&nbsp;</span>X
          </a>
        ) : (
          <span
            className="header-x header-x--soon"
            title={words.xSoon}
            aria-label={`X: ${words.xSoon}`}
          >
            <span className="long">Follow on&nbsp;</span>X
          </span>
        )}
        <WhoAmI href={onBook ? "#judgment" : "/#judgment"} />
        <Ribbon mint={mint} />
      </nav>
    </header>
  );
}
