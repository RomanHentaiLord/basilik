import "server-only";

/** The coin's mint address. Empty until launch → the whole site runs in demo mode. */
export function tokenMint(): string | null {
  return process.env.TOKEN_MINT?.trim() || null;
}

/**
 * The site's address without the scheme, for the card image ("Find your own page at …").
 * SITE_URL wins; on Vercel the production domain is known on its own. Null when neither is set.
 */
export function siteHost(): string | null {
  const url = process.env.SITE_URL?.trim() || process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (!url) return null;
  return url.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}
