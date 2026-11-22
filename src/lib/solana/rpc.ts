/**
 * Minimal JSON-RPC client. Works with any Solana RPC (Helius free plan is enough).
 * Server-only: the URL contains the API key.
 */

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

export async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const [result] = await rpcBatch<T>([{ method, params }]);
  return result;
}

const RETRIES = 4;

function backoff(attempt: number): Promise<void> {
  // 1s, 2s, 4s, 8s, each ±25%: what Helius recommends after a 429.
  const base = 1000 * 2 ** attempt;
  const ms = base * (0.75 + Math.random() * 0.5);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Send several calls in one HTTP request. Results come back in the same order.
 * Rate limits (429) and server errors are retried with backoff; anything else fails at once.
 */
export async function rpcBatch<T>(
  calls: { method: string; params: unknown[] }[],
): Promise<T[]> {
  if (calls.length === 0) return [];
  const body = JSON.stringify(calls.map((call, id) => ({ jsonrpc: "2.0", id, ...call })));

  let response: Response | null = null;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    response = await fetch(rpcUrl(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      cache: "no-store",
    });
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === RETRIES) break;
    await backoff(attempt);
  }
  if (!response || !response.ok) {
    throw new RpcError(`RPC HTTP ${response?.status ?? "no response"}`, response?.status);
  }

  const payload = (await response.json()) as RpcResponse<T>[] | RpcResponse<T>;
  const list = Array.isArray(payload) ? payload : [payload];
  const byId = new Map(list.map((item) => [item.id, item]));
  return calls.map((call, id) => {
    const item = byId.get(id);
    if (!item) throw new RpcError(`No RPC response for ${call.method}`);
    if (item.error) throw new RpcError(item.error.message, item.error.code);
    return item.result as T;
  });
}
