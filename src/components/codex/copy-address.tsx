"use client";

import { useState } from "react";

/** A small link-styled button that copies text and says so for a moment. */
export function CopyButton({ text, label, done }: { text: string; label: string; done: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="codex-link codex-focus cursor-pointer border-0 bg-transparent p-0 text-[18px]"
      aria-live="polite"
    >
      {copied ? done : label}
    </button>
  );
}
