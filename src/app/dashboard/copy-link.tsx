"use client";

import { useState } from "react";

/** Copies the public page link; the label confirms, no toast needed. */
export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard.writeText(url).then(
          () => setCopied(true),
          () => setCopied(false),
        )
      }
      className="inline-flex min-h-11 min-w-20 items-center justify-center px-4 text-sm font-semibold shadow-[inset_0_0_0_1.5px_currentColor] hover:bg-[color-mix(in_oklch,currentColor_8%,transparent)]"
    >
      <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}
