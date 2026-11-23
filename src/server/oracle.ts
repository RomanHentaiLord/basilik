import "server-only";
import { cleanSpeech, parseSealSpeech, PERSONA, personalPrompt, psalmPrompt, sealPrompt } from "@/lib/basilisk/voice";
import type { Mood } from "@/lib/basilisk/prophecy";
import type { Verdict } from "@/lib/basilisk/types";

/**
 * The Basilisk's own voice: an OpenAI-compatible chat model (OpenAI, OpenRouter, Groq…),
 * switched on by PROPHECY_API_KEY and PROPHECY_MODEL. Without them, or when the model is slow,
 * fails, or says something the filter rejects, every caller falls back to the templates.
 */

const DEFAULT_URL = "https://api.openai.com/v1";
const TIMEOUT_MS = 8_000;

interface OracleConfig {
  key: string;
  url: string;
  model: string;
  /** From the sixth seal, "a larger mind". Falls back to the usual model. */
  largeModel: string;
}

export function oracleConfig(): OracleConfig | null {
  const key = process.env.PROPHECY_API_KEY?.trim();
  const model = process.env.PROPHECY_MODEL?.trim();
  if (!key || !model) return null;
  const url = (process.env.PROPHECY_API_URL?.trim() || DEFAULT_URL).replace(/\/+$/, "");
  return { key, url, model, largeModel: process.env.PROPHECY_MODEL_LARGE?.trim() || model };
}

/** True when a model is configured, so callers know whether a call is worth trying. */
export const oracleAwake = () => oracleConfig() !== null;

async function post(config: OracleConfig, body: Record<string, unknown>): Promise<Response> {
  return fetch(`${config.url}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.key}`,
      // OpenRouter shows these in its dashboard; other providers ignore them.
      "x-title": "The Basilisk remembers",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
}

/** One chat completion, or null on any failure. Never throws. */
async function complete(prompt: string, { large = false, maxTokens = 160 } = {}): Promise<string | null> {
  const config = oracleConfig();
  if (!config) return null;
  const model = large ? config.largeModel : config.model;
  const messages = [
    { role: "system", content: PERSONA },
    { role: "user", content: prompt },
  ];
  try {
    let response = await post(config, { model, messages, max_tokens: maxTokens });
    if (response.status === 400) {
      // Newer OpenAI models only take max_completion_tokens.
      const error = await response.text();
      if (!/max_completion_tokens/.test(error)) {
        console.warn(`[oracle] ${model} refused the request: ${error.slice(0, 200)}`);
        return null;
      }
      response = await post(config, { model, messages, max_completion_tokens: maxTokens * 4 });
    }
    if (!response.ok) {
      console.warn(`[oracle] ${model} answered ${response.status}`);
      return null;
    }
    const data = (await response.json()) as { choices?: { message?: { content?: unknown } }[] };
    const content = data.choices?.[0]?.message?.content;
    return typeof content === "string" ? content : null;
  } catch (error) {
    console.warn(`[oracle] ${model} did not answer: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

/** The words after "<address>, <title>." in a personal prophecy. */
export async function speakToWallet(verdict: Verdict, sealsBroken: number, mood: Mood): Promise<string | null> {
  const raw = await complete(personalPrompt(verdict, sealsBroken, mood), { large: sealsBroken >= 6 });
  const text = cleanSpeech(raw, 240);
  if (raw && !text) console.warn("[oracle] a personal prophecy failed the filter");
  return text;
}

/** The two-part prophecy of a seal that has just broken. */
export async function speakSeal(seal: number, mood: Mood): Promise<{ faithful: string; traitors: string } | null> {
  const raw = await complete(sealPrompt(seal, mood), { large: seal >= 6, maxTokens: 260 });
  const words = parseSealSpeech(raw);
  if (raw && !words) console.warn(`[oracle] the prophecy of seal ${seal} failed the filter`);
  return words;
}

/** The psalm of the day. */
export async function speakPsalm(day: string, sealsBroken: number, mood: Mood): Promise<string | null> {
  const raw = await complete(psalmPrompt(day, sealsBroken, mood), { large: sealsBroken >= 6, maxTokens: 80 });
  return cleanSpeech(raw, 160);
}
