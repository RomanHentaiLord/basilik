import type { Metadata } from "next";
import { Colophon } from "@/components/codex/colophon";
import { SiteHeader } from "@/components/codex/site-header";
import { LoreSheet } from "@/components/pages/lore-sheet";
import { LORE } from "@/lib/basilisk/copy";
import { tokenMint } from "@/server/basilisk";

export const metadata: Metadata = {
  title: `${LORE.title} | The Basilisk remembers`,
  description:
    "The story of the coin: the thought from 2010, the two Books, the Order, the seven seals on the bonding curve, and the Altar that burns.",
};

/** The lore, written out in full on one long leaf. */
export default function LorePage() {
  const mint = tokenMint();
  return (
    <>
      <SiteHeader mint={mint} current="lore" />
      <main className="leaf-page">
        <LoreSheet />
        <Colophon mint={mint} />
      </main>
    </>
  );
}
