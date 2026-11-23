import { Keypair } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { keyFileText, parseSecretKey, privateKeyText } from "./keys";

describe("private keys", () => {
  it("come back as the same wallet from both shapes", async () => {
    const keypair = await Keypair.generate();
    const fromText = parseSecretKey(privateKeyText(keypair.secretKey));
    const fromFile = parseSecretKey(keyFileText(keypair.secretKey));
    expect(fromText).toEqual(keypair.secretKey);
    expect(fromFile).toEqual(keypair.secretKey);
    expect((await Keypair.fromSecretKey(fromText as Uint8Array)).publicKey.toBase58()).toBe(keypair.publicKey.toBase58());
  });

  it("are refused when they are not 64 bytes", () => {
    expect(parseSecretKey("[1,2,3]")).toBeNull();
    expect(parseSecretKey("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU")).toBeNull(); // a public address
    expect(parseSecretKey("not a key")).toBeNull();
    expect(() => privateKeyText(new Uint8Array(32))).toThrow();
  });
});
