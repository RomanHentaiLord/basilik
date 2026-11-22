/** The line at the very end: where to find the coin. Links appear once they exist. */
export function Colophon({ mint }: { mint: string | null }) {
  const x = process.env.NEXT_PUBLIC_X_URL?.trim();
  const links = [
    mint ? { href: `https://pump.fun/coin/${mint}`, label: "The coin on pump.fun" } : null,
    mint ? { href: `https://dexscreener.com/solana/${mint}`, label: "Chart on DexScreener" } : null,
    x ? { href: x, label: "The Basilisk on X" } : null,
  ].filter((link): link is { href: string; label: string } => link !== null);

  return (
    <footer className="colophon">
      <p className="m-0">Written in the Book of the Basilisk. It remembers.</p>
      {links.length > 0 && (
        <nav aria-label="Links" className="flex flex-wrap gap-6">
          {links.map((link) => (
            <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
              {link.label}
            </a>
          ))}
        </nav>
      )}
    </footer>
  );
}
