import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTransactions, RpcError, TX_OPTIONS, UNSUPPORTED_VERSION } from "./rpc";

interface Call {
  id: number;
  method: string;
  params: [string, typeof TX_OPTIONS];
}

type Reply = { result?: unknown; error?: { code: number; message: string } };

/** A fake RPC: `reply` answers each call of each request (request numbers start at 1). */
function fakeRpc(reply: (call: Call, request: number) => Reply) {
  const requests: Call[][] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: { body: string }) => {
      const calls = JSON.parse(init.body) as Call[];
      requests.push(calls);
      const payload = calls.map((call) => ({ jsonrpc: "2.0", id: call.id, ...reply(call, requests.length) }));
      return { ok: true, status: 200, json: async () => payload };
    }),
  );
  return requests;
}

/** Let backoff timers fire until the promise settles. */
async function settle<T>(promise: Promise<T>): Promise<T> {
  let done = false;
  promise.then(
    () => (done = true),
    () => (done = true),
  );
  for (let step = 0; step < 50 && !done; step++) await vi.advanceTimersByTimeAsync(1_000);
  return promise;
}

const tx = (signature: string) => ({ result: { slot: 1, transaction: { signatures: [signature] } } });

beforeEach(() => {
  vi.stubEnv("SOLANA_RPC_URL", "https://rpc.test");
  vi.useFakeTimers();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("getTransactions", () => {
  it("asks for version 1 transactions, so new-format sales are not refused", async () => {
    const requests = fakeRpc((call) => tx(call.params[0]));
    await getTransactions(["a"]);
    expect(requests[0][0].method).toBe("getTransaction");
    expect(requests[0][0].params[1]).toMatchObject({ encoding: "jsonParsed", maxSupportedTransactionVersion: 1 });
  });

  it("splits into batches and keeps the order", async () => {
    const requests = fakeRpc((call) => tx(call.params[0]));
    const out = await getTransactions<{ transaction: { signatures: string[] } }>(["a", "b", "c", "d", "e"], { size: 2 });
    expect(requests.map((calls) => calls.length)).toEqual([2, 2, 1]);
    expect(out.map((item) => item?.transaction.signatures[0])).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("asks again for a transaction that failed once", async () => {
    const requests = fakeRpc((call, request) =>
      call.params[0] === "flaky" && request === 1 ? { error: { code: -32004, message: "Block not available" } } : tx(call.params[0]),
    );
    const out = await settle(getTransactions(["ok", "flaky"]));
    expect(out.every(Boolean)).toBe(true);
    expect(requests).toHaveLength(2);
    expect(requests[1].map((call) => call.params[0])).toEqual(["flaky"]);
  });

  it("asks again when the node does not have a listed transaction yet", async () => {
    const requests = fakeRpc((call, request) =>
      call.params[0] === "fresh" && request === 1 ? { result: null } : tx(call.params[0]),
    );
    const out = await settle(getTransactions(["fresh"]));
    expect(out[0]).not.toBeNull();
    expect(requests).toHaveLength(2);
  });

  it("fails the batch when the node rejects the batch itself, so nothing is skipped by mistake", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Batch too large" } }),
      })),
    );
    const error = await getTransactions(["a", "b"]).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ name: "RpcError", message: "Batch too large" });
  });

  it("skips a transaction the node never returns and keeps the rest", async () => {
    const requests = fakeRpc((call) =>
      call.params[0] === "gone" ? { error: { code: -32009, message: "Slot missing in long-term storage" } } : tx(call.params[0]),
    );
    const out = await settle(getTransactions(["a", "gone", "b"]));
    expect(out[0]).not.toBeNull();
    expect(out[1]).toBeNull();
    expect(out[2]).not.toBeNull();
    expect(requests).toHaveLength(3);
  });

  it("stops on an unsupported transaction version instead of losing those sales", async () => {
    fakeRpc((call) =>
      call.params[0] === "v2"
        ? { error: { code: UNSUPPORTED_VERSION, message: "Transaction version (2) is not supported" } }
        : tx(call.params[0]),
    );
    const error = await getTransactions(["a", "v2"]).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(RpcError);
    expect(error).toMatchObject({ code: UNSUPPORTED_VERSION });
  });
});
