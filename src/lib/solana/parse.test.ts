import { describe, expect, it } from "vitest";
import { isSolanaAddress, shortAddress } from "./address";
import { parseTransaction, type ParsedTransaction, type TokenBalance } from "./parse";

const OWNER = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
const OTHER = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
const MINT = "Nt3dBasi1iskMint1111111111111111111111111pump";
const WSOL = "So11111111111111111111111111111111111111112";

function balance(accountIndex: number, owner: string, mint: string, raw: string): TokenBalance {
  return { accountIndex, owner, mint, uiTokenAmount: { amount: raw, decimals: mint === WSOL ? 9 : 6 } };
}

function tx(partial: {
  pre: TokenBalance[];
  post: TokenBalance[];
  preSol?: number[];
  postSol?: number[];
  keys?: string[];
  fee?: number;
  err?: unknown;
}): ParsedTransaction {
  const keys = partial.keys ?? [OWNER, "pool", "program"];
  return {
    blockTime: 1_790_000_000,
    slot: 1,
    meta: {
      err: partial.err ?? null,
      fee: partial.fee ?? 5_000,
      preBalances: partial.preSol ?? keys.map(() => 10_000_000_000),
      postBalances: partial.postSol ?? keys.map(() => 10_000_000_000),
      preTokenBalances: partial.pre,
      postTokenBalances: partial.post,
    },
    transaction: { signatures: ["sig"], message: { accountKeys: keys.map((pubkey) => ({ pubkey })) } },
  };
}

describe("parseTransaction", () => {
  it("finds the wallet among lookup-table accounts when only static keys are listed", () => {
    const event = parseTransaction(
      {
        blockTime: 1_790_000_000,
        slot: 1,
        version: 0,
        meta: {
          err: null,
          fee: 5_000,
          preBalances: [5_000_000_000, 0, 10_000_000_000],
          postBalances: [5_000_000_000, 0, 9_500_000_000],
          preTokenBalances: [],
          postTokenBalances: [balance(3, OWNER, MINT, "250000000000")],
          loadedAddresses: { writable: [OWNER], readonly: [] },
        },
        transaction: { signatures: ["sig"], message: { staticAccountKeys: [OTHER, "pool"] } },
      },
      OWNER,
      MINT,
    );
    // Without the loaded addresses the SOL payment is invisible and this would read as a transfer in.
    expect(event).toMatchObject({ kind: "buy", amount: 250_000 });
  });

  it("buy: tokens in, SOL out", () => {
    const event = parseTransaction(
      tx({
        pre: [],
        post: [balance(3, OWNER, MINT, "250000000000")],
        preSol: [10_000_000_000, 0, 0],
        postSol: [9_500_000_000, 0, 0],
      }),
      OWNER,
      MINT,
    );
    expect(event).toMatchObject({ kind: "buy", amount: 250_000, signature: "sig" });
  });

  it("sell: tokens out, SOL in", () => {
    const event = parseTransaction(
      tx({
        pre: [balance(3, OWNER, MINT, "250000000000")],
        post: [balance(3, OWNER, MINT, "50000000000")],
        preSol: [10_000_000_000, 0, 0],
        postSol: [10_400_000_000, 0, 0],
      }),
      OWNER,
      MINT,
    );
    expect(event).toMatchObject({ kind: "sell", amount: 200_000 });
  });

  it("sell paid in wrapped SOL counts as a sale", () => {
    const event = parseTransaction(
      tx({
        pre: [balance(3, OWNER, MINT, "100000000000"), balance(4, OWNER, WSOL, "0")],
        post: [balance(3, OWNER, MINT, "0"), balance(4, OWNER, WSOL, "300000000")],
      }),
      OWNER,
      MINT,
    );
    expect(event?.kind).toBe("sell");
  });

  it("transfer out that closes the account: rent refund is not a sale", () => {
    const event = parseTransaction(
      tx({
        pre: [balance(3, OWNER, MINT, "100000000000")],
        post: [balance(4, OTHER, MINT, "100000000000")],
        preSol: [10_000_000_000, 0, 0],
        postSol: [10_002_039_280 - 5_000, 0, 0],
      }),
      OWNER,
      MINT,
    );
    expect(event).toMatchObject({ kind: "out", amount: 100_000 });
  });

  it("receiving tokens for free is a transfer in", () => {
    const event = parseTransaction(
      tx({ pre: [], post: [balance(3, OWNER, MINT, "5000000")], preSol: [0, 0, 0], postSol: [0, 0, 0], keys: [OTHER, OWNER, "program"] }),
      OWNER,
      MINT,
    );
    expect(event?.kind).toBe("in");
  });

  it("ignores failed transactions and other tokens", () => {
    expect(parseTransaction(tx({ pre: [], post: [balance(3, OWNER, MINT, "1")], err: { code: 1 } }), OWNER, MINT)).toBeNull();
    expect(parseTransaction(tx({ pre: [], post: [balance(3, OWNER, WSOL, "1")] }), OWNER, MINT)).toBeNull();
  });
});

describe("addresses", () => {
  it("validates base58 public keys", () => {
    expect(isSolanaAddress(OWNER)).toBe(true);
    expect(isSolanaAddress("hello")).toBe(false);
    expect(isSolanaAddress("0OIl0OIl0OIl0OIl0OIl0OIl0OIl0OIl")).toBe(false);
  });

  it("shortens addresses for the Books", () => {
    expect(shortAddress(OWNER)).toBe("7xKX…gAsU");
  });
});
