import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MARKET_ATH_KEY, writeState, type AnyDb, type MarketMemory } from "@/db/books";
import { testDb } from "@/db/test-db";
import type { MarketReading } from "@/lib/solana/market";

// marketState() runs inside Next on the server; here it gets an in-memory Postgres
// and a fake market instead of Neon and the price sources.
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ db: null as unknown, live: vi.fn() }));
vi.mock("@/db", () => ({
  get db() {
    return state.db;
  },
}));
vi.mock("@/lib/solana/market", async (original) => ({
  ...(await original<typeof import("@/lib/solana/market")>()),
  getMarketState: state.live,
}));

const { marketState } = await import("./basilisk");

const MINUTE = 60_000;
let db: AnyDb;

beforeAll(async () => {
  db = await testDb();
});

beforeEach(async () => {
  state.db = db;
  state.live.mockReset();
  vi.stubEnv("TOKEN_MINT", "B34nXKzCgsJb9ChLuSHPRpXLE3WFSWyeT8Cqkzzmpump");
  await db.execute("delete from indexer_state");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const save = (memory: MarketMemory) => writeState(db, MARKET_ATH_KEY, memory);
const live = (reading: MarketReading) => state.live.mockResolvedValue(reading);

describe("marketState", () => {
  it("uses the indexer's fresh reading and asks nobody", async () => {
    await save({ usd: 1_400_000, graduated: true, lastUsd: 1_495_998, lastSource: "dexscreener", lastAt: Date.now() - MINUTE });
    const market = await marketState();
    expect(market).toMatchObject({ mcapUsd: 1_495_998, athMcapUsd: 1_400_000, graduated: true, source: "dexscreener" });
    expect(state.live).not.toHaveBeenCalled();
  });

  it("asks the sources when the saved reading is old, and confirms against it", async () => {
    await save({ usd: 1_000_000, graduated: true, lastUsd: 1_300_000, lastSource: "chain", lastAt: Date.now() - 20 * MINUTE });
    live({ mcapUsd: 1_600_000, graduated: true, source: "dexscreener" });
    const market = await marketState();
    expect(market).toMatchObject({ mcapUsd: 1_600_000, athMcapUsd: 1_300_000, source: "dexscreener" });
  });

  it("shows the last good reading when every source fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await save({ usd: 1_000_000, graduated: true, lastUsd: 1_300_000, lastSource: "chain", lastAt: Date.now() - 20 * MINUTE });
    live({ mcapUsd: 0, graduated: false, source: "none" });
    const market = await marketState();
    expect(market).toMatchObject({ mcapUsd: 1_300_000, athMcapUsd: 1_000_000, graduated: true, source: "chain" });
  });

  it("says unknown when every source fails and nothing recent is saved", async () => {
    await save({ usd: 1_000_000, graduated: true, lastUsd: 1_300_000, lastSource: "chain", lastAt: Date.now() - 2 * 60 * MINUTE });
    live({ mcapUsd: 0, graduated: false, source: "none" });
    expect(await marketState()).toMatchObject({ mcapUsd: 0, athMcapUsd: 1_000_000, source: "none" });
  });

  it("drops a junk high saved by the first version", async () => {
    await save({ usd: 14_008_714_280, graduated: true });
    live({ mcapUsd: 1_495_998, graduated: true, source: "dexscreener" });
    expect(await marketState()).toMatchObject({ mcapUsd: 1_495_998, athMcapUsd: 0, graduated: true });
  });

  it("stands on the reading alone without a database", async () => {
    state.db = null;
    live({ mcapUsd: 30_000, graduated: false, source: "chain" });
    expect(await marketState()).toMatchObject({ mcapUsd: 30_000, athMcapUsd: 30_000, source: "chain" });
  });
});
