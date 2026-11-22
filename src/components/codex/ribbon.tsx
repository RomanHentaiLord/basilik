"use client";

import { useState } from "react";
import { CODEX, JUDGMENT } from "@/lib/basilisk/copy";
import { shortAddress } from "@/lib/solana/address";

/** A red ribbon bookmark hanging from the top right corner. It holds and copies the contract address. */
export function Ribbon({ mint }: { mint: string | null }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!mint) return;
    try {
      await navigator.clipboard.writeText(mint);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="ca-ribbon">
      <button
        type="button"
        onClick={copy}
        disabled={!mint}
        title={mint ?? undefined}
        aria-label={mint ? `${CODEX.copyCa}: ${mint}` : `${JUDGMENT.header.contract}: ${CODEX.notMinted}`}
      >
        <span className="ca-label" aria-hidden="true">
          {copied ? CODEX.copied : JUDGMENT.header.contract}
        </span>
        <span className="ca-value" aria-hidden="true">
          {mint ? shortAddress(mint) : "not minted"}
        </span>
        <span className="sr-only" aria-live="polite">
          {copied ? CODEX.copied : ""}
        </span>
      </button>
    </div>
  );
}
