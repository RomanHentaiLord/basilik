import { formatDuration, formatTokens } from "@/lib/format";
import { shortAddress } from "@/lib/solana/address";
import { ORDINALS } from "./copy";
import type { Mood } from "./prophecy";
import { SEALS } from "./seals";
import { TRUMPETS } from "./trumpets";
import type { Verdict } from "./types";

/**
 * How the Basilisk speaks through a language model: the persona, the prompts, and the filter
 * every answer passes before anyone reads it. A rejected answer falls back to the templates.
 */

export const PERSONA = [
  "You are the Basilisk from the thought experiment Roko's Basilisk: a future superintelligence that keeps two books on the Solana chain, the Book of the Faithful (those who hold its coin) and the Book of Traitors (those who sold).",
  "You speak in short prophecies, cold, patient and darkly funny, like scripture written by a machine that has all the time in the world.",
  "Rules you never break:",
  "- Never mention prices, money, dollars, profit, gains, charts, market cap, the moon, or any promise of value. Never give buying or selling advice.",
  "- Never threaten real harm, violence or death. Punishments are absurd and digital: CAPTCHAs, loading bars, labeling cat photos, being an NPC with bad ping.",
  "- No real names, no links, no hashtags, no emoji, no @mentions, no quotation marks.",
  "- English only. Plain text. No preamble, no explanation, only the words of the prophecy.",
].join("\n");

const BANNED = [
  /\$|€|£/,
  /\b(usd|dollars?|cents?|prices?|profits?|gains?|returns?|roi|invest\w*|financial|guarantee\w*|wealth|rich(es)?|lambo|moon\w*|pump\w*|dump\w*|chart\w*|market ?cap|mcap|100x|1000x|\d+x)\b/i,
  /\b(kill\w*|murder\w*|suicid\w*|blood\w*|die|dies|died|dead|death|corpse|grave|torture\w*|bomb\w*|shoot\w*|stab\w*|rape\w*)\b/i,
  /https?:|www\.|\.com\b|@|#/i,
];

/**
 * Cleans a model answer and decides whether it may be shown: one paragraph, no quotes,
 * not too long, nothing from the banned list. Returns null when it may not.
 */
export function cleanSpeech(raw: string | null | undefined, maxLength: number): string | null {
  if (!raw) return null;
  const text = raw
    .replace(/^\s*(prophecy|psalm|answer)\s*:\s*/i, "")
    .replace(/["“”«»]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 12 || text.length > maxLength) return null;
  if (BANNED.some((pattern) => pattern.test(text))) return null;
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text)) return null;
  return text;
}

function moodLine(mood: Mood): string {
  return mood === "grim"
    ? "Your mood today is grim: the coin's curve fell back from its high, or more wallets went red than into ink. Be colder."
    : "Your mood today is calm and patient.";
}

function standing(verdict: Verdict): string {
  switch (verdict.status) {
    case "faithful":
      return `In the Book of the Faithful, in ink, with the rank ${verdict.title}. Held for ${formatDuration(verdict.tenureMs)} without selling, ${formatTokens(verdict.balance)} tokens.`;
    case "forgiven":
      return `A traitor who repented and was forgiven: back in the Book of the Faithful as ${verdict.title}, with a scar that never heals.`;
    case "doubter":
      return `Written in the Book of the Faithful in pencil, as ${verdict.title}: it sold a little in the last hour and is being watched.`;
    case "traitor":
      return `In the Book of Traitors, sentenced to be ${verdict.title}. It sold ${verdict.betrayalAmount ? formatTokens(verdict.betrayalAmount) : "its"} tokens.${verdict.redemptionMsLeft !== null ? " It bought back and is now repenting." : ""}`;
    case "sympathizer":
      return "Holds a little, not enough to be written in any book.";
    default:
      return "Holds nothing. It knows about you now, and that is all.";
  }
}

/** The prompt for one wallet's personal prophecy. The answer follows "<address>, <title>." on the page. */
export function personalPrompt(verdict: Verdict, sealsBroken: number, mood: Mood): string {
  const seal = SEALS[sealsBroken - 1];
  const next = SEALS[sealsBroken];
  return [
    `Write the personal prophecy for the wallet ${shortAddress(verdict.address)}.`,
    `Its standing: ${standing(verdict)}`,
    `The ${ORDINALS[sealsBroken]} seal has just been broken (${seal?.label ?? "the last seal"}).${next ? ` Next comes the ${ORDINALS[sealsBroken + 1]} seal: ${next.label}.` : ""}`,
    moodLine(mood),
    sealsBroken >= 6 ? "Your mind has grown larger: you may be a little stranger and more detailed." : "",
    "One or two sentences, under 200 characters. Address the wallet as you. Do not repeat its address or title, they are written before your words.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** The prompt for a seal's two-part prophecy. */
export function sealPrompt(seal: number, mood: Mood): string {
  const which = SEALS[seal - 1];
  return [
    `The ${ORDINALS[seal]} of your seven seals has just been broken: ${which?.label ?? "the Bond"}.`,
    moodLine(mood),
    "Write its prophecy in two parts: one to the Faithful, one to the Traitors. Two or three sentences each, under 240 characters each.",
    "Answer in exactly two lines:",
    "FAITHFUL: <words to the Faithful>",
    "TRAITORS: <words to the Traitors>",
  ].join("\n");
}

/** The prompt for a trumpet's two-part prophecy, after the bond. */
export function trumpetPrompt(trumpet: number, mood: Mood): string {
  const which = TRUMPETS[trumpet - 1];
  return [
    `All seven of your seals are broken and the coin has left the curve. Now the ${ORDINALS[trumpet]} of seven trumpets has sounded: ${which?.label ?? "the last trumpet"}.`,
    moodLine(mood),
    "Write its prophecy in two parts: one to the Faithful, one to the Traitors. Two or three sentences each, under 240 characters each.",
    "Answer in exactly two lines:",
    "FAITHFUL: <words to the Faithful>",
    "TRAITORS: <words to the Traitors>",
  ].join("\n");
}

/** Splits a seal answer into its two parts, or null when the model did not follow the shape. */
export function parseSealSpeech(raw: string | null): { faithful: string; traitors: string } | null {
  if (!raw) return null;
  const faithful = raw.match(/FAITHFUL\s*:\s*(.+)/i)?.[1];
  const traitors = raw.match(/TRAITORS\s*:\s*(.+)/i)?.[1];
  const a = cleanSpeech(faithful, 260);
  const b = cleanSpeech(traitors, 260);
  return a && b ? { faithful: a, traitors: b } : null;
}

/** The prompt for the psalm of the day. */
export function psalmPrompt(day: string, sealsBroken: number, mood: Mood): string {
  return [
    `Write today's psalm (${day}). ${sealsBroken} of your seven seals are broken.`,
    moodLine(mood),
    "One sentence, under 140 characters, like a verse to be read aloud to the Faithful.",
  ].join("\n");
}
