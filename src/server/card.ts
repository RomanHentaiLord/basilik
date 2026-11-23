import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import type { Verdict } from "@/lib/basilisk/types";
import { isSolanaAddress } from "@/lib/solana/address";
import { judgeWallet, rememberedVerdict } from "./basilisk";

/**
 * The verdict shown on /v/<address> and drawn on its card image. Read from the Books when a
 * visitor has judged the wallet (the usual case: the share button sits under the verdict),
 * from the chain otherwise. Once per request: the page, its metadata and nothing else share it.
 */
export const verdictForPage = cache(async (address: string): Promise<Verdict | null> => {
  // A verdict is judged at the moment it is asked for, never prerendered.
  await connection();
  if (!isSolanaAddress(address)) return null;
  try {
    const remembered = await rememberedVerdict(address);
    if (remembered) return remembered;
  } catch (error) {
    console.error(`[card] could not read ${address} from the Books`, error);
  }
  try {
    return await judgeWallet(address);
  } catch (error) {
    console.error(`[card] could not judge ${address}`, error);
    return null;
  }
});
