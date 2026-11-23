import { Keypair, VersionedTransaction } from "@solana/web3.js";
import { beforeAll, describe, expect, it } from "vitest";
import { burnAllTransaction, burnCheckedData, tokenAccountsFrom, TOKEN_2022_PROGRAM, TOKEN_PROGRAM } from "./burn";

let OWNER = "";
let MINT = "";
let ACCOUNT_A = "";
let ACCOUNT_B = "";
const BLOCKHASH = "4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi";

beforeAll(async () => {
  const keys = await Promise.all([Keypair.generate(), Keypair.generate(), Keypair.generate(), Keypair.generate()]);
  [OWNER, MINT, ACCOUNT_A, ACCOUNT_B] = keys.map((key) => key.publicKey.toBase58());
});

describe("BurnChecked data", () => {
  it("is the instruction number, the amount in little-endian and the decimals", () => {
    expect([...burnCheckedData(BigInt(1_000_000), 6)]).toEqual([15, 0x40, 0x42, 0x0f, 0, 0, 0, 0, 0, 6]);
  });

  it("refuses to burn nothing", () => {
    expect(() => burnCheckedData(BigInt(0), 6)).toThrow();
  });
});

describe("the Altar's token accounts", () => {
  it("keeps accounts with a balance, in either token program", () => {
    const accounts = tokenAccountsFrom({
      value: [
        { pubkey: "A", account: { owner: TOKEN_PROGRAM, data: { parsed: { info: { tokenAmount: { amount: "5000000", decimals: 6 } } } } } },
        { pubkey: "B", account: { owner: TOKEN_2022_PROGRAM, data: { parsed: { info: { tokenAmount: { amount: "7", decimals: 6 } } } } } },
        { pubkey: "C", account: { owner: TOKEN_PROGRAM, data: { parsed: { info: { tokenAmount: { amount: "0", decimals: 6 } } } } } },
        { pubkey: "D", account: { owner: "SomethingElse111111111111111111111111111111", data: { parsed: { info: { tokenAmount: { amount: "9", decimals: 6 } } } } } },
      ],
    });
    expect(accounts).toEqual([
      { address: "A", program: TOKEN_PROGRAM, amount: BigInt(5_000_000), decimals: 6 },
      { address: "B", program: TOKEN_2022_PROGRAM, amount: BigInt(7), decimals: 6 },
    ]);
  });
});

describe("the burn transaction", () => {
  it("burns every account, signed and paid by the Altar alone", () => {
    const bytes = burnAllTransaction({
      owner: OWNER,
      mint: MINT,
      blockhash: BLOCKHASH,
      accounts: [
        { address: ACCOUNT_A, program: TOKEN_PROGRAM, amount: BigInt(12_345_678_000_000), decimals: 6 },
        { address: ACCOUNT_B, program: TOKEN_2022_PROGRAM, amount: BigInt(1), decimals: 6 },
      ],
    });
    const tx = VersionedTransaction.deserialize(bytes);
    const message = tx.message;
    const keys = message.staticAccountKeys.map((key) => key.toBase58());

    expect(message.header.numRequiredSignatures).toBe(1);
    expect(keys[0]).toBe(OWNER);
    expect(message.recentBlockhash).toBe(BLOCKHASH);
    expect(message.compiledInstructions).toHaveLength(2);

    const [first, second] = message.compiledInstructions;
    expect(keys[first.programIdIndex]).toBe(TOKEN_PROGRAM);
    expect(first.accountKeyIndexes.map((i) => keys[i])).toEqual([ACCOUNT_A, MINT, OWNER]);
    expect(first.data[0]).toBe(15);
    expect(new DataView(Uint8Array.from(first.data).buffer).getBigUint64(1, true)).toBe(BigInt(12_345_678_000_000));
    expect(keys[second.programIdIndex]).toBe(TOKEN_2022_PROGRAM);
  });

  it("refuses an empty Altar", () => {
    expect(() => burnAllTransaction({ owner: OWNER, mint: MINT, blockhash: BLOCKHASH, accounts: [] })).toThrow("nothing to burn");
  });
});
