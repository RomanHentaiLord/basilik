import { afterEach, describe, expect, it, vi } from "vitest";
import { mergeMarketMemory, savedReading } from "@/db/books";
import {
  bondingCurveAddress,
  chain,
  curveMarketCapSol,
  decodeBondingCurve,
  dexScreener,
  forgetSolPrice,
  getMarketState,
  marketCapFromPairs,
  type Provider,
  type ProviderName,
} from "./market";

const MINT = "B34nXKzCgsJb9ChLuSHPRpXLE3WFSWyeT8Cqkzzmpump";
const OTHER = "So11111111111111111111111111111111111111112";

/** A BondingCurve account as the pump.fun program stores it. */
function curveBytes(fields: { vTok: bigint; vSol: bigint; supply: bigint; complete: boolean }): Uint8Array {
  const data = new Uint8Array(81);
  const view = new DataView(data.buffer);
  data.set([23, 183, 248, 55, 96, 216, 172, 96]); // discriminator
  view.setBigUint64(8, fields.vTok, true);
  view.setBigUint64(16, fields.vSol, true);
  view.setBigUint64(24, fields.vTok - BigInt(279_900_000_000_000), true);
  view.setBigUint64(32, fields.vSol - BigInt(30_000_000_000), true);
  view.setBigUint64(40, fields.supply, true);
  data[48] = fields.complete ? 1 : 0;
  return data;
}

/** A fresh pump.fun coin: 1.073B virtual tokens against 30 virtual SOL, 1B supply. */
const FRESH = { vTok: BigInt(1_073_000_000_000_000), vSol: BigInt(30_000_000_000), supply: BigInt(1_000_000_000_000_000) };

const never: Provider = () => new Promise(() => {});
const fails: Provider = async () => {
  throw new Error("fetch failed");
};
const answers =
  (quote: Awaited<ReturnType<Provider>>): Provider =>
  async () =>
    quote;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("bonding curve", () => {
  it("decodes the reserves, the supply and the complete flag", () => {
    const curve = decodeBondingCurve(curveBytes({ ...FRESH, complete: false }));
    expect(curve).toEqual({
      virtualTokenReserves: FRESH.vTok,
      virtualSolReserves: FRESH.vSol,
      tokenTotalSupply: FRESH.supply,
      complete: false,
    });
    expect(decodeBondingCurve(curveBytes({ ...FRESH, complete: true }))?.complete).toBe(true);
  });

  it("refuses data too short to be a curve", () => {
    expect(decodeBondingCurve(new Uint8Array(40))).toBeNull();
  });

  it("prices a fresh coin at about 28 SOL, like pump.fun does", () => {
    const curve = decodeBondingCurve(curveBytes({ ...FRESH, complete: false }))!;
    expect(curveMarketCapSol(curve)).toBeCloseTo(27.96, 2);
  });

  it("reads the curve over RPC and prices it with the SOL price", async () => {
    vi.stubEnv("SOLANA_RPC_URL", "https://rpc.test");
    forgetSolPrice();
    const curveAddress = await bondingCurveAddress(MINT);
    const seen: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { body: string }) => {
        const calls = JSON.parse(init.body) as { id: number; method: string; params: unknown }[];
        const payload = calls.map((call) => {
          seen.push(call.method);
          if (call.method === "getAccountInfo") {
            expect((call.params as [string])[0]).toBe(curveAddress);
            const data = Buffer.from(curveBytes({ ...FRESH, complete: false })).toString("base64");
            return { jsonrpc: "2.0", id: call.id, result: { value: { data: [data, "base64"] } } };
          }
          return {
            jsonrpc: "2.0",
            id: call.id,
            result: { token_info: { supply: 1, decimals: 9, price_info: { price_per_token: 200 } } },
          };
        });
        return { ok: true, status: 200, json: async () => payload };
      }),
    );
    const quote = await chain(MINT);
    expect(seen).toEqual(["getAccountInfo", "getAsset"]);
    expect(quote?.graduated).toBe(false);
    expect(quote?.mcapUsd).toBeCloseTo(27.96 * 200, 0);

    // The SOL price is remembered: the next reading costs one plain RPC call.
    await chain(MINT);
    expect(seen).toEqual(["getAccountInfo", "getAsset", "getAccountInfo"]);
  });

  it("does not ask for the SOL price once the coin has graduated", async () => {
    vi.stubEnv("SOLANA_RPC_URL", "https://rpc.test");
    forgetSolPrice();
    const seen: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { body: string }) => {
        const calls = JSON.parse(init.body) as { id: number; method: string }[];
        const data = Buffer.from(curveBytes({ ...FRESH, complete: true })).toString("base64");
        const payload = calls.map((call) => {
          seen.push(call.method);
          return { jsonrpc: "2.0", id: call.id, result: { value: { data: [data, "base64"] } } };
        });
        return { ok: true, status: 200, json: async () => payload };
      }),
    );
    expect(await chain(MINT)).toEqual({ graduated: true });
    expect(seen).toEqual(["getAccountInfo"]);
  });
});

describe("DexScreener", () => {
  it("takes the coin's most liquid pair and ignores pairs where it is the quote", () => {
    const mcap = marketCapFromPairs(
      [
        { baseToken: { address: OTHER }, quoteToken: undefined, liquidity: { usd: 9e9 }, marketCap: 9e10 } as never,
        { baseToken: { address: MINT }, dexId: "pumpswap", liquidity: { usd: 50_000 }, marketCap: 300_000 },
        { baseToken: { address: MINT }, dexId: "meteora", liquidity: { usd: 10 }, marketCap: 9_000_000 },
      ],
      MINT,
    );
    expect(mcap).toBe(300_000);
  });

  it("reads both response shapes", async () => {
    const pair = { chainId: "solana", baseToken: { address: MINT }, marketCap: 42_000 };
    for (const body of [[pair], { pairs: [pair] }]) {
      vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => body })));
      expect(await dexScreener(MINT)).toEqual({ mcapUsd: 42_000 });
    }
  });
});

describe("getMarketState", () => {
  const order = (chainP: Provider, dex: Provider, helius: Provider, gecko: Provider): [ProviderName, Provider][][] => [
    [
      ["chain", chainP],
      ["dexscreener", dex],
    ],
    [
      ["helius", helius],
      ["geckoterminal", gecko],
    ],
  ];

  it("answers from the chain without waiting for a slow price site", async () => {
    const reading = await getMarketState(
      MINT,
      order(answers({ mcapUsd: 5_000, graduated: false }), never, never, never),
      60_000,
    );
    expect(reading).toEqual({ mcapUsd: 5_000, graduated: false, source: "chain" });
  });

  it("does not spend Helius credits when the chain or DexScreener has the price", async () => {
    const helius = vi.fn(answers({ mcapUsd: 1 }));
    const gecko = vi.fn(answers({ mcapUsd: 1 }));
    const reading = await getMarketState(MINT, order(answers({ graduated: true }), answers({ mcapUsd: 1_495_998 }), helius, gecko), 50);
    expect(reading).toEqual({ mcapUsd: 1_495_998, graduated: true, source: "dexscreener" });
    expect(helius).not.toHaveBeenCalled();
    expect(gecko).not.toHaveBeenCalled();
  });

  it("after graduation takes the price from the next source that knows it", async () => {
    const reading = await getMarketState(
      MINT,
      order(answers({ graduated: true }), fails, answers({ mcapUsd: 120_000 }), never),
      50,
    );
    expect(reading).toEqual({ mcapUsd: 120_000, graduated: true, source: "helius" });
  });

  it("does not let a price site declare graduation", async () => {
    const reading = await getMarketState(
      MINT,
      order(fails, answers({ mcapUsd: 80_000, graduated: true }), never, never),
      50,
    );
    expect(reading).toEqual({ mcapUsd: 80_000, graduated: false, source: "dexscreener" });
  });

  it("skips impossible numbers", async () => {
    const reading = await getMarketState(
      MINT,
      order(answers({ mcapUsd: Number.NaN }), answers({ mcapUsd: 1e15 }), answers({ mcapUsd: -5 }), answers({ mcapUsd: 9_000 })),
      50,
    );
    expect(reading).toEqual({ mcapUsd: 9_000, graduated: false, source: "geckoterminal" });
  });

  it("says so when nobody answers, instead of inventing a number", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const reading = await getMarketState(MINT, order(fails, never, fails, never), 50);
    expect(reading).toEqual({ mcapUsd: 0, graduated: false, source: "none" });
    expect(log.mock.calls[0][0]).toContain("chain: fetch failed");
    expect(log.mock.calls[0][0]).toMatch(/dexscreener: no answer in 0\.\ds/);
  });

  it("uses the local override when it is set", async () => {
    vi.stubEnv("MARKET_MCAP_USD", "260000");
    vi.stubEnv("MARKET_GRADUATED", "true");
    const reading = await getMarketState(MINT, order(never, never, never, never), 50);
    expect(reading).toEqual({ mcapUsd: 260_000, graduated: true, source: "override" });
  });
});

describe("market memory", () => {
  it("counts a high once two good readings in a row reach it", () => {
    const first = mergeMarketMemory(null, { mcapUsd: 30_000, graduated: false, source: "chain" }, 1_000);
    expect(first).toEqual({ usd: 0, graduated: false, lastUsd: 30_000, lastSource: "chain", lastAt: 1_000, changed: true });

    const second = mergeMarketMemory(first, { mcapUsd: 32_000, graduated: false, source: "chain" }, 2_000);
    expect(second).toMatchObject({ usd: 30_000, lastUsd: 32_000, lastAt: 2_000 });
  });

  it("ignores a single wild reading", () => {
    // The old DexScreener code once read a junk pair as a $14B market cap.
    let memory = mergeMarketMemory({ usd: 1_400_000, lastUsd: 1_500_000 }, { mcapUsd: 14_008_714_280, graduated: true, source: "dexscreener" });
    expect(memory.usd).toBe(1_500_000);
    memory = mergeMarketMemory(memory, { mcapUsd: 1_495_998, graduated: true, source: "dexscreener" });
    expect(memory.usd).toBe(1_500_000);
  });

  it("starts over from memory saved before readings were confirmed", () => {
    // What the first live run stored on a test coin: a junk $14B high, never confirmed.
    const memory = mergeMarketMemory({ usd: 14_008_714_280, graduated: true }, { mcapUsd: 1_495_998, graduated: true, source: "dexscreener" }, 5);
    expect(memory).toEqual({ usd: 0, graduated: true, lastUsd: 1_495_998, lastSource: "dexscreener", lastAt: 5, changed: true });
  });

  it("keeps the high, graduation and the last good reading when every source fails", () => {
    const before = { usd: 90_000, graduated: true, lastUsd: 95_000, lastSource: "chain", lastAt: 5 };
    const memory = mergeMarketMemory(before, { mcapUsd: 0, graduated: false, source: "none" }, 9);
    expect(memory).toEqual({ ...before, changed: false });
  });

  it("offers the last good reading only while it is fresh", () => {
    const memory = { usd: 90_000, lastUsd: 95_000, lastSource: "chain", lastAt: 1_000 };
    expect(savedReading(memory, 1_000 + 60_000, 5 * 60_000)).toEqual({ mcapUsd: 95_000, source: "chain", at: 1_000 });
    expect(savedReading(memory, 1_000 + 6 * 60_000, 5 * 60_000)).toBeNull();
    expect(savedReading({ usd: 0, lastUsd: 0, lastSource: "none", lastAt: 1_000 }, 1_000, 5 * 60_000)).toBeNull();
    expect(savedReading(null, 1_000, 5 * 60_000)).toBeNull();
  });
});
