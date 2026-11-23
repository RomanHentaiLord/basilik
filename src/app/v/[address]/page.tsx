import type { Metadata } from "next";
import { Suspense } from "react";
import { Colophon } from "@/components/codex/colophon";
import { SiteHeader } from "@/components/codex/site-header";
import { VerdictSheet } from "@/components/pages/verdict-sheet";
import { CARD } from "@/lib/basilisk/copy";
import { shortAddress } from "@/lib/solana/address";
import { tokenMint } from "@/server/basilisk";
import { verdictForPage } from "@/server/card";

/** Title and card for the shared link. The card image itself comes from opengraph-image.tsx. */
export async function generateMetadata({ params }: PageProps<"/v/[address]">): Promise<Metadata> {
  const { address } = await params;
  const verdict = await verdictForPage(address);
  if (!verdict) return { title: `${CARD.notFoundTitle} | ${CARD.brand}`, robots: { index: false } };
  const short = shortAddress(address);
  const title = CARD.pageTitle(short, verdict.title);
  const description = CARD.description(short, verdict.title, verdict.line);
  return {
    title,
    description,
    openGraph: { title, description, type: "article", siteName: CARD.brand },
    twitter: { card: "summary_large_image", title, description },
  };
}

/** A wallet's verdict on a page of its own: what a link shared on X opens. */
export default function VerdictPage({ params }: PageProps<"/v/[address]">) {
  const mint = tokenMint();
  return (
    <>
      <SiteHeader mint={mint} current="verdict" />
      <main className="leaf-page">
        <Suspense
          fallback={
            <article className="sheet verdict-sheet">
              <div className="page-frame" aria-hidden="true" />
              <p className="sheet-lede">{CARD.loading}</p>
            </article>
          }
        >
          {params.then(({ address }) => (
            <Verdict address={address} />
          ))}
        </Suspense>
        <Colophon mint={mint} />
      </main>
    </>
  );
}

async function Verdict({ address }: { address: string }) {
  return <VerdictSheet address={address} verdict={await verdictForPage(address)} />;
}
