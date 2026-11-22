import { PublicKey } from "@solana/web3.js";
import type { MarketState } from "@/lib/basilisk/seals";
import { rpc } from "./rpc";

/**
 * Market cap and graduation status for the seals. Several sources are asked at once, because
 * any one of them can be down, or blocked on the network the site runs from:
 *
 * 1. The chain, through our own RPC. While the coin is on the pump.fun bonding curve,
 *    market cap = virtual SOL reserves × total supply ÷ virtual token reserves (what pump.fun
 *    shows), in USD with the SOL price from Helius. The curve's `complete` flag is the only
 *    source we trust for graduation: anyone can open some other pool and fool a price site.
 * 2. DexScreener.
 * 3. Helius DAS (getAsset): price × supply, for coins in its top 10k by volume.
 * 4. GeckoTerminal.
 *
 * The first source in that order that gives a market cap wins; each gets a few seconds.
 * The last two are only asked when the first two have no price: a DAS call costs 10 Helius
 * credits (a plain RPC call costs 1), and the free plan has 1M a month.
 * For local testing, MARKET_MCAP_USD / MARKET_GRADUATED override everything.
 */

export type ProviderName = "chain" | "dexscreener" | "helius" | "geckoterminal";
export type MarketSource = ProviderName | "override" | "none" | "demo";

export interface MarketReading extends MarketState {
  source: MarketSource;
}

/** One source's answer. A missing field means that source does not know it. */
export interface Quote {
  mcapUsd?: number;
  graduated?: boolean;
}

export type Provider = (mint: string) => Promise<Quote | null>;

const TIMEOUT_MS = 4_000;
/** No memecoin is worth this much; a bigger number is a broken source. */
const MAX_PLAUSIBLE_USD = 1e12;
const PUMP_PROGRAM = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
const WSOL = "So11111111111111111111111111111111111111112";

// ── pump.fun bonding curve ─────────────────────────────────────────────────

/** The pump.fun BondingCurve account: 8-byte discriminator, five u64 fields, then `complete`. */
export interface BondingCurve {
  virtualTokenReserves: bigint;
  virtualSolReserves: bigint;
  tokenTotalSupply: bigint;
  complete: boolean;
}

export function decodeBondingCurve(data: Uint8Array): BondingCurve | null {
  if (data.length < 49) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return {
    virtualTokenReserves: view.getBigUint64(8, true),
    virtualSolReserves: view.getBigUint64(16, true),
    tokenTotalSupply: view.getBigUint64(40, true),
    complete: data[48] !== 0,
  };
}

/** Market cap of a coin on the curve, in SOL. Token units cancel out; lamports become SOL. */
export function curveMarketCapSol(curve: BondingCurve): number {
  if (curve.virtualTokenReserves === BigInt(0)) return 0;
  const lamports = (curve.virtualSolReserves * curve.tokenTotalSupply) / curve.virtualTokenReserves;
  return Number(lamports) / 1e9;
}

export async function bondingCurveAddress(mint: string): Promise<string> {
  const [address] = await PublicKey.findProgramAddress(
    [new TextEncoder().encode("bonding-curve"), new PublicKey(mint).toBytes()],
    PUMP_PROGRAM,
  );
  return address.toBase58();
}

interface DasAsset {
  token_info?: {
    supply?: number;
    decimals?: number;
    price_info?: { price_per_token?: number };
  };
}

/** USD price and supply from Helius DAS (any other RPC answers with an error). */
async function dasPrice(mint: string): Promise<{ price: number; supply: number } | null> {
  const asset = await rpc<DasAsset | null>("getAsset", { id: mint, options: { showFungible: true } });
  const info = asset?.token_info;
  const price = info?.price_info?.price_per_token;
  if (!info || !price) return null;
  return { price, supply: (info.supply ?? 0) / 10 ** (info.decimals ?? 0) };
}

/** Helius refreshes DAS prices every 10 minutes; asking more often than this buys nothing. */
const SOL_PRICE_TTL_MS = 5 * 60_000;
let solPrice: { usd: number; at: number } | null = null;

/** SOL in USD, from Helius DAS, remembered for a few minutes. */
async function solUsd(): Promise<number | null> {
  if (solPrice && Date.now() - solPrice.at < SOL_PRICE_TTL_MS) return solPrice.usd;
  const quote = await dasPrice(WSOL).catch(() => null);
  if (quote) solPrice = { usd: quote.price, at: Date.now() };
  return quote?.price ?? solPrice?.usd ?? null;
}

/** For tests. */
export function forgetSolPrice() {
  solPrice = null;
}

export const chain: Provider = async (mint) => {
  const account = await rpc<{ value: { data: [string, string] } | null }>("getAccountInfo", [
    await bondingCurveAddress(mint),
    { encoding: "base64", commitment: "confirmed" },
  ]);
  if (!account?.value) return null; // Not a pump.fun coin.
  const curve = decodeBondingCurve(Buffer.from(account.value.data[0], "base64"));
  if (!curve) return null;
  // After graduation the curve is frozen; the price lives in the new pool.
  if (curve.complete) return { graduated: true };
  const sol = await solUsd();
  return sol ? { mcapUsd: curveMarketCapSol(curve) * sol, graduated: false } : { graduated: false };
};

// ── Price sites ────────────────────────────────────────────────────────────

export interface DexPair {
  chainId?: string;
  dexId?: string;
  baseToken?: { address?: string };
  liquidity?: { usd?: number };
  marketCap?: number;
  fdv?: number;
}

/** Market cap from the coin's most liquid pair; pairs where it is the quote token say nothing about it. */
export function marketCapFromPairs(pairs: DexPair[], mint: string): number | null {
  const own = pairs.filter((pair) => pair.baseToken?.address === mint && (pair.chainId ?? "solana") === "solana");
  if (own.length === 0) return null;
  const best = own.reduce((a, b) => ((b.liquidity?.usd ?? 0) > (a.liquidity?.usd ?? 0) ? b : a));
  return best.marketCap ?? best.fdv ?? null;
}

export const dexScreener: Provider = async (mint) => {
  const response = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mint}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = (await response.json()) as DexPair[] | { pairs?: DexPair[] | null };
  const pairs = Array.isArray(data) ? data : (data.pairs ?? []);
  const mcapUsd = marketCapFromPairs(pairs, mint);
  return mcapUsd ? { mcapUsd } : null;
};

export const heliusDas: Provider = async (mint) => {
  const quote = await dasPrice(mint);
  return quote ? { mcapUsd: quote.price * quote.supply } : null;
};

export const geckoTerminal: Provider = async (mint) => {
  const response = await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/${mint}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = (await response.json()) as {
    data?: { attributes?: { market_cap_usd?: string | null; fdv_usd?: string | null } };
  };
  const attributes = data.data?.attributes;
  const mcapUsd = Number(attributes?.market_cap_usd ?? attributes?.fdv_usd ?? 0);
  return mcapUsd > 0 ? { mcapUsd } : null;
};

// ── Putting it together ────────────────────────────────────────────────────

/**
 * In order of trust. Each group is asked at once; the next group only when the one before
 * gave no price.
 */
export const PROVIDERS: [ProviderName, Provider][][] = [
  [
    ["chain", chain],
    ["dexscreener", dexScreener],
  ],
  [
    ["helius", heliusDas],
    ["geckoterminal", geckoTerminal],
  ],
];

type Outcome = { quote: Quote | null; error?: string };

/** Never throws and never takes longer than `ms`. */
async function ask(provider: Provider, mint: string, ms: number): Promise<Outcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<Outcome>((resolve) => {
    timer = setTimeout(() => resolve({ quote: null, error: `no answer in ${ms / 1000}s` }), ms);
  });
  const answer = Promise.resolve()
    .then(() => provider(mint))
    .then(
      (quote): Outcome => ({ quote }),
      (error): Outcome => ({ quote: null, error: error instanceof Error ? error.message : String(error) }),
    );
  try {
    return await Promise.race([answer, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function plausible(usd: number | undefined): usd is number {
  return typeof usd === "number" && Number.isFinite(usd) && usd > 0 && usd < MAX_PLAUSIBLE_USD;
}

export async function getMarketState(
  mint: string,
  groups: [ProviderName, Provider][][] = PROVIDERS,
  timeoutMs = TIMEOUT_MS,
): Promise<MarketReading> {
  const override = process.env.MARKET_MCAP_USD;
  if (override) {
    return { mcapUsd: Number(override), graduated: process.env.MARKET_GRADUATED === "true", source: "override" };
  }

  const failures: string[] = [];
  let graduated: boolean | undefined;

  for (const group of groups) {
    // The group is asked at once; answers are read in order of trust, so a fast trusted
    // answer does not wait for a slow site.
    const pending = group.map(([, provider]) => ask(provider, mint, timeoutMs));
    for (let index = 0; index < group.length; index++) {
      const [name] = group[index];
      const { quote, error } = await pending[index];
      if (error) failures.push(`${name}: ${error}`);
      if (name === "chain" && quote?.graduated !== undefined) graduated = quote.graduated;
      if (plausible(quote?.mcapUsd)) {
        return { mcapUsd: quote.mcapUsd, graduated: graduated ?? false, source: name };
      }
    }
  }

  console.error(`[market] no market cap for ${mint}${failures.length > 0 ? ` (${failures.join("; ")})` : ""}`);
  return { mcapUsd: 0, graduated: graduated ?? false, source: "none" };
}

/** Market used in demo mode: three seals broken, halfway to the fourth. */
export const DEMO_MARKET: MarketState = { mcapUsd: 312_000, graduated: true };
