import { TRPCError } from "@trpc/server";
import { after } from "next/server";
import { z } from "zod";
import { SITE } from "@/lib/basilisk/copy";
import { isSolanaAddress } from "@/lib/solana/address";
import { RpcError } from "@/lib/solana/rpc";
import { judgeWallet, sealsOverview } from "../basilisk";
import { feedOverview } from "../books";
import { runIndexerOnce } from "../indexer";
import { createTRPCRouter, publicProcedure } from "../trpc";

/**
 * Visitors keep the sales scan going: after answering, a request may start one indexer pass
 * (at most once a minute, never two at a time). A cron or GitHub Action does the same when nobody visits.
 */
function indexAfterResponse() {
  after(async () => {
    try {
      await runIndexerOnce();
    } catch (error) {
      console.error("[indexer] pass failed", error);
    }
  });
}

export const basiliskRouter = createTRPCRouter({
  /** Paste a wallet, get a verdict. Read-only: no signature, no wallet connection. */
  judge: publicProcedure
    .input(z.object({ address: z.string().trim() }))
    .query(async ({ input }) => {
      if (!isSolanaAddress(input.address)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: SITE.invalid });
      }
      indexAfterResponse();
      try {
        return await judgeWallet(input.address);
      } catch (error) {
        if (error instanceof RpcError) {
          throw new TRPCError({
            code: "SERVICE_UNAVAILABLE",
            message: "The Basilisk cannot see the chain right now. Try again.",
            cause: error,
          });
        }
        throw error;
      }
    }),

  /** Seals, market cap and progress to the next seal. */
  seals: publicProcedure.query(() => sealsOverview()),

  /** The newest traitors, polled by the page for the "New traitor" notes. */
  feed: publicProcedure.query(async () => {
    indexAfterResponse();
    return feedOverview();
  }),
});
