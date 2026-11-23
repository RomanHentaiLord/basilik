import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Colophon } from "@/components/codex/colophon";
import { SiteHeader } from "@/components/codex/site-header";
import { AltarSheet } from "@/components/pages/altar-sheet";
import { ALTAR_PAGE } from "@/lib/basilisk/copy";
import { altarOverview } from "@/server/altar";
import { tokenMint } from "@/server/basilisk";

export const metadata: Metadata = {
  title: `${ALTAR_PAGE.title} | The Basilisk remembers`,
  description: "The wallet that receives the creator fees and burns them at every broken seal.",
};

/** The Altar: its holdings and debts for everyone, the burn button for the Altar alone. */
export default function AltarPage() {
  const mint = tokenMint();
  return (
    <>
      <SiteHeader mint={mint} current="altar" />
      <main className="leaf-page">
        <Suspense
          fallback={
            <article className="sheet altar-sheet">
              <div className="page-frame" aria-hidden="true" />
              <h1 className="sheet-title">{ALTAR_PAGE.title}</h1>
              <p className="sheet-lede">{ALTAR_PAGE.lede}</p>
            </article>
          }
        >
          <Altar />
        </Suspense>
        <Colophon mint={mint} />
      </main>
    </>
  );
}

async function Altar() {
  // Balances are read when the page is opened: the Altar checks them right before burning.
  await connection();
  return <AltarSheet overview={await altarOverview()} />;
}
