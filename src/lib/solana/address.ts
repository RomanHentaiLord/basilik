/**
 * Address helpers shared by the server and the browser.
 * No @solana/web3.js here: the wallet form runs in the browser, and the SDK is heavy.
 */

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const DIGITS = new Map([...ALPHABET].map((char, index) => [char, index]));

/** Decodes a base58 string into bytes, or null when it has a character outside the alphabet. */
export function decodeBase58(value: string): Uint8Array | null {
  if (value.length === 0) return null;
  const bytes: number[] = []; // little-endian while decoding
  for (const char of value) {
    const digit = DIGITS.get(char);
    if (digit === undefined) return null;
    let carry = digit;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  let zeros = 0;
  while (zeros < value.length && value[zeros] === "1") zeros++;
  const out = new Uint8Array(zeros + bytes.length);
  for (let i = 0; i < bytes.length; i++) out[zeros + i] = bytes[bytes.length - 1 - i];
  return out;
}

/** Encodes bytes as base58: a transaction signature as explorers show it. */
export function encodeBase58(bytes: Uint8Array): string {
  const digits: number[] = []; // little-endian base-58 digits
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = "";
  for (const byte of bytes) {
    if (byte !== 0) break;
    out += "1";
  }
  for (let i = digits.length - 1; i >= 0; i--) out += ALPHABET[digits[i]];
  return out;
}

/** True for any base58 string that decodes to a 32-byte Solana public key. */
export function isSolanaAddress(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 32 || trimmed.length > 44) return false;
  return decodeBase58(trimmed)?.length === 32;
}

/** "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" → "7xKX…gAsU" */
export function shortAddress(address: string, size = 4): string {
  if (address.length <= size * 2 + 1) return address;
  return `${address.slice(0, size)}…${address.slice(-size)}`;
}
