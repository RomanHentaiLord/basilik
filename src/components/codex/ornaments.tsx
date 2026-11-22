/**
 * Drawn ornaments for the book. Plain SVG, no hooks, so server pages can use them.
 * The book is rendered twice (two-page and one-page layouts), so anything that defines
 * an SVG id takes a `uid` to keep ids unique on the page.
 */

type EmblemTone = "gilt" | "gold" | "ink" | "wax";

/** The ouroboros: a serpent biting its tail around a watching eye. */
export function Emblem({ uid, tone, className }: { uid?: string; tone: EmblemTone; className?: string }) {
  const gradientId = uid ? `${uid}-gilt` : undefined;
  const main =
    tone === "gilt" && gradientId
      ? `url(#${gradientId})`
      : tone === "ink"
        ? "var(--ink)"
        : tone === "wax"
          ? "currentColor"
          : "var(--gold-light)";
  const accent =
    tone === "ink" ? "var(--rubric)" : tone === "gilt" ? "#f7df95" : tone === "wax" ? "rgba(255,225,205,0.35)" : "var(--gold-light)";
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      {tone === "gilt" && gradientId && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f7df95" />
            <stop offset="0.45" stopColor="#d4a845" />
            <stop offset="0.72" stopColor="#9a7124" />
            <stop offset="1" stopColor="#e5c26c" />
          </linearGradient>
        </defs>
      )}
      {/* Body, from just behind the head all the way round to the tail in its mouth. */}
      <path d="M57.5 16.8 A34 34 0 1 1 37 18.6" stroke={main} strokeWidth="7" strokeLinecap="round" />
      <path
        d="M57.5 16.8 A34 34 0 1 1 37 18.6"
        stroke={tone === "ink" ? "var(--parchment-light)" : "rgba(40,12,6,0.55)"}
        strokeWidth="1.2"
        strokeDasharray="2.5 4.5"
        strokeLinecap="round"
      />
      {/* Head, jaws open round the tail. */}
      <path d="M55 9.5 C 62 10, 66 14, 64 18.5 C 62 23, 55 24, 50 22 L 41 19.8 L 49 16.6 L 41.5 13.4 Z" fill={main} />
      <circle cx="57.6" cy="15.6" r="1.6" fill={tone === "ink" ? "var(--parchment-light)" : "#2a0c08"} />
      {/* The eye in the middle of the ring. */}
      <path d="M27 50 Q 50 30, 73 50 Q 50 70, 27 50 Z" stroke={main} strokeWidth="3" fill="none" />
      <circle cx="50" cy="50" r="9" fill={main} />
      <ellipse cx="50" cy="50" rx="2.6" ry="7.5" fill={tone === "ink" ? "var(--parchment-light)" : "#2a0c08"} />
      <circle cx="47" cy="46.5" r="1.4" fill={accent} />
    </svg>
  );
}

/** A pointing hand, the medieval reader's mark for "look here". */
export function Manicule() {
  return (
    <svg viewBox="0 0 60 32" fill="none" aria-hidden="true">
      <rect x="1.5" y="9" width="8.5" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M10 10.5 C 15 7.5, 22 8, 27 10 L 54 10 C 58.5 10, 58.5 16, 54 16 L 34.5 16 C 37 17, 37 20.5, 33.5 21 C 36.5 22, 35.5 25.5, 32 25.8 C 34 27.5, 32 30, 29 29.5 L 18 29.5 C 13 29.5, 10 26.5, 10 22.5 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M27 13 L 40 13" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

/** A corner flourish for the gilt frame on the cover. */
export function Fleuron({ corner }: { corner: "tl" | "tr" | "bl" | "br" }) {
  const flip = {
    tl: "",
    tr: "translate(40 0) scale(-1 1)",
    bl: "translate(0 40) scale(1 -1)",
    br: "translate(40 40) scale(-1 -1)",
  }[corner];
  const position = {
    tl: { top: "0.35em", left: "0.35em" },
    tr: { top: "0.35em", right: "0.35em" },
    bl: { bottom: "0.35em", left: "0.35em" },
    br: { bottom: "0.35em", right: "0.35em" },
  }[corner];
  return (
    <svg viewBox="0 0 40 40" fill="none" style={position} aria-hidden="true">
      <g transform={flip} stroke="rgba(231,196,106,0.85)">
        <path d="M3 3 H 24 M3 3 V 24 M3 3 L 12 12" strokeWidth="2" />
        <circle cx="15" cy="15" r="3" fill="rgba(231,196,106,0.85)" stroke="none" />
        <path d="M24 3 c 6.5 0 8.5 6.5 3 8.5 M3 24 c 0 6.5 6.5 8.5 8.5 3" strokeWidth="1.6" />
      </g>
    </svg>
  );
}

export function Chevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 8 L 12 15 L 19 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Marbled endpaper: combed bands of lapis, slate and a little ochre and oxblood,
 * dragged into swirls the way marblers drew paint floating on size.
 */
export function Marble({ uid }: { uid: string }) {
  const bands: [string, number][] = [
    ["#1d3160", 10],
    ["#2c4a80", 7],
    ["#a27f3e", 3],
    ["#22386a", 9],
    ["#d6c59b", 2],
    ["#1a2a52", 8],
    ["#6b231c", 3],
    ["#355891", 6],
    ["#b89553", 2],
    ["#203361", 9],
  ];
  const width = bands.reduce((sum, [, w]) => sum + w, 0);
  let x = 0;
  return (
    <svg className="marble" viewBox="0 0 340 420" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <pattern id={`${uid}-bands`} width={width} height="420" patternUnits="userSpaceOnUse">
          {bands.map(([color, w], i) => {
            const rect = <rect key={i} x={x} y="0" width={w + 0.5} height="420" fill={color} />;
            x += w;
            return rect;
          })}
        </pattern>
        <filter id={`${uid}-swirl`} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.013" numOctaves="3" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="150" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <rect x="-90" y="-90" width="520" height="600" fill={`url(#${uid}-bands)`} filter={`url(#${uid}-swirl)`} />
      <rect width="340" height="420" fill="rgba(18,12,6,0.22)" />
    </svg>
  );
}
