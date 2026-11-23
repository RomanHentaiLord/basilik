import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { isSolanaAddress } from "@/lib/solana/address";
import { RpcError } from "@/lib/solana/rpc";
import { AltarError, prepareBurn } from "../altar";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const altarRouter = createTRPCRouter({
  /**
   * The Altar's offering: an unsigned transaction that burns all of its coin. Phantom signs
   * and sends it; the server never holds a key. Refused for any wallet but the Altar.
   */
  prepareBurn: publicProcedure
    .input(z.object({ owner: z.string().trim().refine(isSolanaAddress) }))
    .mutation(async ({ input }) => {
      try {
        return await prepareBurn(input.owner);
      } catch (error) {
        if (error instanceof AltarError) throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
        if (error instanceof RpcError) {
          throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "The chain did not answer. Try again.", cause: error });
        }
        throw error;
      }
    }),
});
