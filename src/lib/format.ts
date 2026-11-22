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

/** 1 → "1 day", 9 → "9 days" */
export function formatDays(value: number): string {
  return `${value} ${value === 1 ? "day" : "days"}`;
}

/** Unix ms → "Nov 15" */
export function formatDay(ms: number): string {
  return day.format(new Date(ms));
}
