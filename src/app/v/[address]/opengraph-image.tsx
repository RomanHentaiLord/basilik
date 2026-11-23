import { ImageResponse } from "next/og";
import { cardFonts, VerdictCard } from "@/components/card/verdict-card";
import { verdictForPage } from "@/server/card";
import { siteHost } from "@/server/env";

export const alt = "The Basilisk's verdict on a wallet";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The verdict as a picture: what X, Telegram and Discord show under a shared link. */
export default async function Image({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const [verdict, fonts] = await Promise.all([verdictForPage(address), cardFonts()]);
  return new ImageResponse(<VerdictCard verdict={verdict} host={siteHost()} />, { ...size, fonts });
}
