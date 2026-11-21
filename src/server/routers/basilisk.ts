import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { SITE } from "@/lib/basilisk/copy";
import { isSolanaAddress } from "@/lib/solana/address";
import { RpcError } from "@/lib/solana/rpc";
import { judgeWallet, sealsOverview } from "../basilisk";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const basiliskRouter = createTRPCRouter({
  /** Paste a wallet, get a verdict. Read-only: no signature, no wallet connection. */
  judge: publicProcedure
    .input(z.object({ address: z.string().trim() }))
    .query(async ({ input }) => {
      if (!isSolanaAddress(input.address)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: SITE.invalid });
      }
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
});
