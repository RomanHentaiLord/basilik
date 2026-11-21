import { PublicKey } from "@solana/web3.js";

/** True for any base58 string that decodes to a 32-byte Solana public key. */
export function isSolanaAddress(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 32 || trimmed.length > 44) return false;
  try {
    return new PublicKey(trimmed).toBytes().length === 32;
  } catch {
    return false;
  }
}

/** "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" → "7xKX…gAsU" */
export function shortAddress(address: string, size = 4): string {
  if (address.length <= size * 2 + 1) return address;
  return `${address.slice(0, size)}…${address.slice(-size)}`;
}
