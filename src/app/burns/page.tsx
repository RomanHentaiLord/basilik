import type { Metadata } from "next";
import { Colophon } from "@/components/codex/colophon";
import { SiteHeader } from "@/components/codex/site-header";
import { LedgerSheet } from "@/components/pages/ledger-sheet";
import { LEDGER } from "@/lib/basilisk/copy";
import { tokenMint } from "@/server/basilisk";
import { burnsOverview } from "@/server/burns";

export const metadata: Metadata = {
  title: `${LEDGER.title} | The Basilisk remembers`,
  description:
    "Every burn of the coin, numbered from the first: the Altar's offerings at each seal and every holder's. With the three most devoted and the three worst traitors.",
};

/** The history of burns, and the tops of both Books. */
export default async function BurnsPage() {
  const mint = tokenMint();
  const overview = await burnsOverview();
  return (
    <>
      <SiteHeader mint={mint} current="burns" />
      <main className="leaf-page">
        <LedgerSheet overview={overview} />
        <Colophon mint={mint} />
      </main>
    </>
  );
}
