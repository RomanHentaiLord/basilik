/**
 * Minimal JSON-RPC client. Works with any Solana RPC (Helius free plan is enough).
 * Server-only: the URL contains the API key.
 */

/**
 * Options for every getTransaction call. Version 1 transactions (SIMD-0385) exist on mainnet:
 * a request that declares less than 1 fails with -32015 on them. Declaring 1 still returns
 * legacy and v0 transactions.
 */
export const TX_OPTIONS = {
  encoding: "jsonParsed",
  maxSupportedTransactionVersion: 1,
  commitment: "confirmed",
} as const;

/** The RPC said it cannot return this transaction version: a configuration problem, never skip it. */
export const UNSUPPORTED_VERSION = -32015;

/** No single RPC request may hang a page or an indexer pass longer than this. */
const REQUEST_TIMEOUT_MS = 20_000;

export class RpcError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message);
    this.name = "RpcError";
  }
}

interface RpcResponse<T> {
  id: number;
  result?: T;
  error?: { code: number; message: string };
}

function rpcUrl(): string {
  const url = process.env.SOLANA_RPC_URL;
  if (!url) throw new RpcError("SOLANA_RPC_URL is not set");
  return url;
}

export interface RpcOptions {
  /** Retries after a rate limit or a server error. Interactive callers with a fallback use fewer. */
  retries?: number;
}

export async function rpc<T>(method: string, params: unknown, options: RpcOptions = {}): Promise<T> {
  const [result] = await rpcBatch<T>([{ method, params }], options);
  return result;
}

const RETRIES = 4;

function backoff(attempt: number): Promise<void> {
  // 1s, 2s, 4s, 8s, each ±25%: what Helius recommends after a 429.
  const base = 1000 * 2 ** attempt;
  const ms = base * (0.75 + Math.random() * 0.5);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** One HTTP request with every call in it; retries rate limits and server errors with backoff. */
async function post<T>(
  calls: { method: string; params: unknown }[],
  retries = RETRIES,
): Promise<Map<number, RpcResponse<T>>> {
  const body = JSON.stringify(calls.map((call, id) => ({ jsonrpc: "2.0", id, ...call })));

  let response: Response | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      response = await fetch(rpcUrl(), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      if (attempt === retries) throw new RpcError(`RPC unreachable: ${error instanceof Error ? error.message : error}`);
      await backoff(attempt);
      continue;
    }
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === retries) break;
    if (response.status === 429 && attempt === 0) {
      console.warn(`[rpc] the RPC is rate limiting us (429) on ${calls[0]?.method}; waiting and retrying`);
    }
    await backoff(attempt);
  }
  if (!response || !response.ok) {
    throw new RpcError(`RPC HTTP ${response?.status ?? "no response"}`, response?.status);
  }

  const payload = (await response.json()) as RpcResponse<T>[] | RpcResponse<T>;
  if (!Array.isArray(payload) && calls.length > 1) {
    // One answer for a whole batch is an error about the batch itself (too large, malformed…).
    throw new RpcError(payload.error?.message ?? "RPC answered a batch with a single result", payload.error?.code);
  }
  const list = Array.isArray(payload) ? payload : [payload];
  return new Map(list.map((item) => [item.id, item]));
}

/**
 * Send several calls in one HTTP request. Results come back in the same order.
 * Any error in any call fails the whole batch.
 */
export async function rpcBatch<T>(calls: { method: string; params: unknown }[], options: RpcOptions = {}): Promise<T[]> {
  if (calls.length === 0) return [];
  const byId = await post<T>(calls, options.retries);
  return calls.map((call, id) => {
    const item = byId.get(id);
    if (!item) throw new RpcError(`No RPC response for ${call.method}`);
    if (item.error) throw new RpcError(item.error.message, item.error.code);
    return item.result as T;
  });
}

/** Like rpcBatch, but a failed call comes back as an RpcError in its place instead of failing the rest. */
export async function rpcBatchSettled<T>(calls: { method: string; params: unknown }[]): Promise<(T | RpcError)[]> {
  if (calls.length === 0) return [];
  const byId = await post<T>(calls);
  return calls.map((call, id) => {
    const item = byId.get(id);
    if (!item) return new RpcError(`No RPC response for ${call.method}`);
    if (item.error) return new RpcError(item.error.message, item.error.code);
    return item.result as T;
  });
}

/** A transaction that failed or was not found is asked for again this many times before it is skipped. */
const ITEM_RETRIES = 2;

/**
 * getTransaction for many signatures, `size` per request, in the order given.
 * A transaction that fails, or that the node does not have yet (a load-balanced RPC can list a
 * signature a moment before it can return the transaction), is asked for again; if it still
 * cannot be had, it comes back as null (and is logged) instead of failing everything else.
 * An unsupported-version error is thrown at once: it means the request itself is wrong, and
 * skipping would lose every such sale.
 */
export async function getTransactions<T>(
  signatures: string[],
  { size = 10, gapMs = 0 }: { size?: number; gapMs?: number } = {},
): Promise<(T | null)[]> {
  const found = new Map<string, T | null>();
  for (let i = 0; i < signatures.length; i += size) {
    // Each transaction in a batch counts against the RPC's requests per second (10 on the
    // Helius free plan): background callers leave a gap so pages and wallet checks still get through.
    if (i > 0 && gapMs > 0) await new Promise((resolve) => setTimeout(resolve, gapMs));
    let pending = signatures.slice(i, i + size);
    for (let attempt = 0; pending.length > 0; attempt++) {
      const results = await rpcBatchSettled<T | null>(
        pending.map((signature) => ({ method: "getTransaction", params: [signature, TX_OPTIONS] })),
      );
      const failed: string[] = [];
      results.forEach((result, index) => {
        const signature = pending[index];
        if (result instanceof RpcError && result.code === UNSUPPORTED_VERSION) throw result;
        if (result !== null && !(result instanceof RpcError)) {
          found.set(signature, result);
        } else if (attempt < ITEM_RETRIES) {
          failed.push(signature);
        } else {
          console.warn(`[rpc] skipped transaction ${signature}: ${result instanceof RpcError ? result.message : "not found"}`);
          found.set(signature, null);
        }
      });
      pending = failed;
      if (pending.length > 0) await backoff(attempt);
    }
  }
  return signatures.map((signature) => found.get(signature) ?? null);
}
