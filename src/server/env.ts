import "server-only";

/** The coin's mint address. Empty until launch → the whole site runs in demo mode. */
export function tokenMint(): string | null {
  return process.env.TOKEN_MINT?.trim() || null;
}
