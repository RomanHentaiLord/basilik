"use client";

import { useState } from "react";
import { CODEX } from "@/lib/basilisk/copy";

/** A red ribbon bookmark hanging over the book. It copies the contract address. */
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
    <div className="codex-ribbon">
      <button type="button" onClick={copy} disabled={!mint} aria-live="polite">
        {!mint ? CODEX.notMinted : copied ? CODEX.copied : CODEX.copyCa}
      </button>
    </div>
  );
}
