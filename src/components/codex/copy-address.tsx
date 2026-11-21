"use client";

import { useState } from "react";

/** A struck-through wallet in the Book of Traitors. Click to copy the full address. */
export function CopyAddress({ address, label }: { address: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={address}
      aria-label={`Copy wallet ${address}`}
      className="codex-focus cursor-pointer border-0 bg-transparent p-0 text-left text-[18px] text-ink"
    >
      <span className="codex-struck">{label}</span>
      <span aria-live="polite" className="ml-2 text-[14px] italic text-ink-muted">
        {copied ? "copied" : ""}
      </span>
    </button>
  );
}
