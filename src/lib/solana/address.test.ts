import { PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { decodeBase58, isSolanaAddress } from "./address";

describe("decodeBase58", () => {
  it("matches @solana/web3.js on real and random keys", () => {
    const keys = [
      "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      "11111111111111111111111111111111",
      "So11111111111111111111111111111111111111112",
      "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    ];
    for (let i = 0; i < 40; i++) {
      const bytes = new Uint8Array(32).map((_, j) => (i * 37 + j * 101 + (i % 3 === 0 && j < 3 ? -j : 0)) & 0xff);
      if (i % 5 === 0) bytes.fill(0, 0, i % 4);
      keys.push(new PublicKey(bytes).toBase58());
    }
    for (const key of keys) {
      expect(Array.from(decodeBase58(key) ?? [])).toEqual(Array.from(new PublicKey(key).toBytes()));
    }
  });

  it("rejects characters outside the alphabet", () => {
    expect(decodeBase58("0OIl")).toBeNull();
    expect(decodeBase58("")).toBeNull();
  });
});

describe("isSolanaAddress", () => {
  it("accepts 32-byte keys only", () => {
    expect(isSolanaAddress("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU")).toBe(true);
    expect(isSolanaAddress("  7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU  ")).toBe(true);
    expect(isSolanaAddress("7xKXtg2CW87d97TXJSDpbD5jBkhe")).toBe(false);
    expect(isSolanaAddress("z".repeat(44))).toBe(false); // decodes to 33 bytes
    expect(isSolanaAddress("hello")).toBe(false);
  });
});

describe("encodeBase58", () => {
  it("is the inverse of decodeBase58", async () => {
    const { decodeBase58, encodeBase58 } = await import("./address");
    for (const value of ["7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", "11111111111111111111111111111111", "1112", "z"]) {
      const bytes = decodeBase58(value);
      expect(bytes).not.toBeNull();
      expect(encodeBase58(bytes as Uint8Array)).toBe(value);
    }
  });
});
