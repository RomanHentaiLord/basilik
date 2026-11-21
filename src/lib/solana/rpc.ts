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

/** Send several calls in one HTTP request. Results come back in the same order. */
export async function rpcBatch<T>(
  calls: { method: string; params: unknown[] }[],
): Promise<T[]> {
  if (calls.length === 0) return [];
  const body = calls.map((call, id) => ({ jsonrpc: "2.0", id, ...call }));
  const response = await fetch(rpcUrl(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new RpcError(`RPC HTTP ${response.status}`, response.status);
  }
  const payload = (await response.json()) as RpcResponse<T>[];
  const byId = new Map(payload.map((item) => [item.id, item]));
  return calls.map((call, id) => {
    const item = byId.get(id);
    if (!item) throw new RpcError(`No RPC response for ${call.method}`);
    if (item.error) throw new RpcError(item.error.message, item.error.code);
    return item.result as T;
  });
}
