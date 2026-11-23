import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CARD } from "@/lib/basilisk/copy";
import type { Verdict } from "@/lib/basilisk/types";
import { shortAddress } from "@/lib/solana/address";

/**
 * The verdict as a 1200×630 card for X and messengers, drawn by next/og (Satori): plain
 * flexbox and inline styles only, colours written out (no CSS variables there).
 */

export const CARD_SIZE = { width: 1200, height: 630 };

const INK = "#2a1e14";
const MUTED = "#5b4a38";
const RUBRIC = "#a8241b";
const PENCIL = "#57524b";

/** The fonts the site uses, as .woff (Satori cannot read .woff2). OFL, kept in assets/fonts. */
export async function cardFonts() {
  const read = (file: string) => readFile(join(process.cwd(), "assets/fonts", file));
  const [regular, italic, semibold, fraktur] = await Promise.all([
    read("eb-garamond-latin-400-normal.woff"),
    read("eb-garamond-latin-400-italic.woff"),
    read("eb-garamond-latin-600-normal.woff"),
    read("unifrakturmaguntia-latin-400-normal.woff"),
  ]);
  return [
    { name: "Garamond", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Garamond", data: italic, weight: 400 as const, style: "italic" as const },
    { name: "Garamond", data: semibold, weight: 600 as const, style: "normal" as const },
    { name: "Fraktur", data: fraktur, weight: 400 as const, style: "normal" as const },
  ];
}

/** The wax seal pressed on the card, with the serpent embossed: red for the Faithful, black for traitors. */
function sealImage(tone: "red" | "black"): string {
  const c =
    tone === "red"
      ? { light: "#d4554a", mid: "#9e1b1b", dark: "#5c0d0c", emboss: "#3c0605" }
      : { light: "#5a514c", mid: "#2b2523", dark: "#0f0c0b", emboss: "#000000" };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="400" height="400">
<defs><radialGradient id="w" cx="0.38" cy="0.32" r="0.75"><stop offset="0" stop-color="${c.light}"/><stop offset="0.5" stop-color="${c.mid}"/><stop offset="1" stop-color="${c.dark}"/></radialGradient></defs>
<path d="M50 4 C 62 3, 70 9, 78 12 C 88 16, 96 28, 95 40 C 99 52, 96 64, 90 72 C 86 84, 74 94, 60 95 C 50 99, 38 97, 28 92 C 16 88, 6 76, 5 62 C 1 52, 3 38, 9 28 C 14 16, 26 7, 38 6 C 42 4, 46 4, 50 4 Z" fill="url(#w)"/>
<circle cx="50" cy="50" r="33" fill="none" stroke="${c.emboss}" stroke-opacity="0.6" stroke-width="2.5"/>
<circle cx="50" cy="50" r="30" fill="none" stroke="#ffe6d2" stroke-opacity="0.18" stroke-width="1"/>
<g transform="translate(22 22) scale(0.56)" fill="none" stroke-opacity="0.6" fill-opacity="0.6">
<path d="M57.5 16.8 A34 34 0 1 1 37 18.6" stroke="${c.emboss}" stroke-width="7" stroke-linecap="round"/>
<path d="M55 9.5 C 62 10, 66 14, 64 18.5 C 62 23, 55 24, 50 22 L 41 19.8 L 49 16.6 L 41.5 13.4 Z" fill="${c.emboss}"/>
<path d="M27 50 Q 50 30, 73 50 Q 50 70, 27 50 Z" stroke="${c.emboss}" stroke-width="3"/>
<circle cx="50" cy="50" r="9" fill="${c.emboss}"/>
</g>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/** The prophecy without the "<address>, <title>." it opens with: the card shows both already. */
function wordsOf(verdict: Verdict): string {
  const prophecy = verdict.prophecy;
  if (verdict.status === "traitor" && prophecy?.punishment) return prophecy.punishment;
  if (!prophecy || prophecy.label === null) return verdict.fate;
  const short = shortAddress(verdict.address);
  return prophecy.text.replace(`${short}, ${verdict.title}. `, "").replace(`${short}. `, "");
}

function bookLine(verdict: Verdict): string {
  const place = verdict.entryNumber !== null && verdict.status !== "traitor" ? `, ${CARD.entry(verdict.entryNumber)}` : "";
  return `${CARD.books[verdict.status]}${place}`;
}

/** A verdict's card. Without a verdict (bad address, chain unreachable), the book's own card. */
export function VerdictCard({ verdict, host }: { verdict: Verdict | null; host: string | null }) {
  const traitor = verdict?.status === "traitor";
  const pencil = verdict?.status === "doubter";
  const stamp = verdict && (verdict.status === "faithful" || verdict.status === "forgiven") ? "red" : traitor ? "black" : null;
  const title = verdict?.title ?? CARD.fallbackTitle;
  const titleSize = title.length > 22 ? 76 : title.length > 16 ? 88 : 100;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        backgroundColor: "#ded0ac",
        backgroundImage: "radial-gradient(circle at 28% 18%, #f2e9d0 0%, #e3d6b3 52%, #c9b588 100%)",
        fontFamily: "Garamond",
        color: INK,
      }}
    >
      <div style={{ position: "absolute", top: 26, left: 26, right: 26, bottom: 26, border: `3px solid ${RUBRIC}`, display: "flex" }} />
      <div style={{ position: "absolute", top: 36, left: 36, right: 36, bottom: 36, border: `1px solid ${RUBRIC}`, display: "flex" }} />

      <div style={{ display: "flex", flexDirection: "column", padding: "72px 96px 64px", width: "100%" }}>
        <div style={{ display: "flex", fontSize: 34, fontStyle: "italic", color: RUBRIC }}>
          {verdict ? (
            <>
              <span>{CARD.judged}&nbsp;</span>
              <span style={traitor ? { textDecoration: "line-through", textDecorationColor: RUBRIC } : {}}>
                {shortAddress(verdict.address)}
              </span>
            </>
          ) : (
            <span>{CARD.fallbackKicker}</span>
          )}
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 14,
            maxWidth: stamp ? 820 : 1000,
            fontFamily: "Fraktur",
            fontSize: titleSize,
            lineHeight: 1.08,
            color: traitor ? RUBRIC : pencil ? PENCIL : INK,
          }}
        >
          {title}
        </div>

        <div style={{ display: "flex", marginTop: 12, fontSize: 32, fontStyle: "italic", color: MUTED }}>
          {verdict ? bookLine(verdict) : CARD.fallbackLine}
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 30,
            paddingLeft: 22,
            borderLeft: `5px solid ${RUBRIC}`,
            maxWidth: stamp ? 800 : 960,
            fontSize: 34,
            lineHeight: 1.32,
            fontStyle: "italic",
          }}
        >
          {verdict ? wordsOf(verdict) : CARD.fallbackWords}
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
          <div style={{ display: "flex", fontFamily: "Fraktur", fontSize: 42, color: RUBRIC }}>{CARD.brand}</div>
          <div style={{ display: "flex", fontSize: 24, fontStyle: "italic", color: MUTED }}>{CARD.invite(host)}</div>
        </div>
      </div>

      {stamp && (
        // eslint-disable-next-line @next/next/no-img-element -- Satori draws plain <img>, not next/image.
        <img
          src={sealImage(stamp)}
          width={210}
          height={210}
          alt=""
          style={{ position: "absolute", right: 78, bottom: 66, transform: "rotate(-9deg)" }}
        />
      )}
    </div>
  );
}
