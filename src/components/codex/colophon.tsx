/** The line under the book: where to find the coin. Links appear once they exist. */
export function Colophon({ mint }: { mint: string | null }) {
  const x = process.env.NEXT_PUBLIC_X_URL;
  const links = [
    mint ? { href: `https://pump.fun/coin/${mint}`, label: "The coin on pump.fun" } : null,
    x ? { href: x, label: "The Basilisk on X" } : null,
  ].filter((link): link is { href: string; label: string } => link !== null);

  return (
    <footer className="mx-auto mt-8 flex max-w-[1320px] flex-wrap items-center justify-between gap-4 px-6 sm:px-2 text-[16px] italic text-[#cdbb92]">
      <p className="m-0">Written in the Book of the Basilisk. It remembers.</p>
      {links.length > 0 && (
        <nav aria-label="Links" className="flex flex-wrap gap-6">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="text-[#e7c46a] underline underline-offset-4 hover:text-[#f3d98f]"
            >
              {link.label}
            </a>
          ))}
        </nav>
      )}
    </footer>
  );
}
