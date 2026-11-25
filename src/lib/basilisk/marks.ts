import { formatTokensShort } from "@/lib/format";
import { MARKS } from "./copy";
import { offeringMark, TRUMPETS } from "./trumpets";
import type { Verdict } from "./types";

/** The lines under a verdict for what it earned for good: trumpets heard, offerings given. */
export function marksOf(verdict: Pick<Verdict, "trumpetsHeard" | "offered">): string[] {
  const lines: string[] = [];
  const heard = verdict.trumpetsHeard ?? [];
  if (heard.length > 0) lines.push(MARKS.heard(heard.map((n) => TRUMPETS[n - 1].roman)));
  const offered = verdict.offered ?? 0;
  const title = offeringMark(offered);
  if (title) lines.push(MARKS.offered(title, formatTokensShort(offered)));
  return lines;
}
