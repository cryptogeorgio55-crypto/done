"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — ignore */
    }
  }
  return (
    <button
      onClick={copy}
      className="rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-medium text-ink-soft hover:bg-surface"
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}
