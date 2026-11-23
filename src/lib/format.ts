/** Number and date formatting shared by the server and the client. English, like the site. */

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });
const compactWhole = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 0 });
const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});
const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const moment = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

/** 1450000 → "1.45M", 923770 → "924K" */
export function formatTokensShort(value: number): string {
  return value >= 1_000_000 ? compact.format(value) : compactWhole.format(value);
}

/** 350000 → "350,000" */
export function formatTokens(value: number): string {
  return whole.format(value);
}

/** 500000 → "$500K" */
export function formatUsd(value: number): string {
  return usd.format(value);
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

/**
 * A stretch of time in the largest whole unit: "45 minutes", "3 hours", "2 days".
 * "down" for time already held, "up" for time still to wait (never says 0 of a wait).
 */
export function formatDuration(ms: number, round: "down" | "up" = "down"): string {
  const r = round === "up" ? Math.ceil : Math.floor;
  const minutes = r(Math.max(0, ms) / MINUTE);
  if (minutes < 60) {
    if (minutes === 0) return round === "up" ? "1 minute" : "under a minute";
    return plural(minutes, "minute");
  }
  const hours = r(ms / HOUR);
  if (hours < 24) return plural(hours, "hour");
  return plural(r(ms / DAY), "day");
}

/** Unix ms → "Nov 15" */
export function formatDay(ms: number): string {
  return day.format(new Date(ms));
}

/** Unix ms → "Nov 15, 14:05 UTC" */
export function formatMoment(ms: number): string {
  return `${moment.format(new Date(ms))} UTC`;
}

/** 0.0079 → "0.79%", 0.25 → "25%" */
export function formatShare(share: number): string {
  const percent = share * 100;
  const digits = percent >= 10 ? 0 : percent >= 1 ? 1 : 2;
  return `${percent.toLocaleString("en-US", { maximumFractionDigits: digits })}%`;
}
