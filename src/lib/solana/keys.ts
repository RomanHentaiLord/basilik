import { decodeBase58, encodeBase58 } from "./address";

/**
 * Private keys in the two shapes people use: the base58 text a wallet imports (Phantom,
 * Solflare: "Import private key") and the Solana CLI key file, a JSON array of 64 bytes.
 * Both hold the same 64-byte secret key: 32 bytes of seed, then the 32-byte public key.
 */

const SECRET_KEY_BYTES = 64;

/** The private key as wallets import it. */
export function privateKeyText(secretKey: Uint8Array): string {
  if (secretKey.length !== SECRET_KEY_BYTES) throw new RangeError("a Solana secret key is 64 bytes");
  return encodeBase58(secretKey);
}

/** A key file as the Solana CLI writes it. */
export function keyFileText(secretKey: Uint8Array): string {
  if (secretKey.length !== SECRET_KEY_BYTES) throw new RangeError("a Solana secret key is 64 bytes");
  return JSON.stringify(Array.from(secretKey));
}

/** Reads a key file or a base58 private key; null when the text is neither. */
export function parseSecretKey(text: string): Uint8Array | null {
  const trimmed = text.trim();
  if (trimmed.startsWith("[")) {
    try {
      const bytes: unknown = JSON.parse(trimmed);
      const valid =
        Array.isArray(bytes) &&
        bytes.length === SECRET_KEY_BYTES &&
        bytes.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255);
      return valid ? Uint8Array.from(bytes as number[]) : null;
    } catch {
      return null;
    }
  }
  const bytes = decodeBase58(trimmed);
  return bytes?.length === SECRET_KEY_BYTES ? bytes : null;
}
