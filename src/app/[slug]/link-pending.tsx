"use client";

import { useLinkStatus } from "next/link";

/**
 * A lamp line along the bottom of the link it sits in (which must be
 * positioned) while that page loads. On venue wifi a tap can take seconds to
 * answer; this says it landed. Always rendered, so nothing shifts.
 */
export function LinkPending() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      data-pending={pending || undefined}
      className="link-pending"
    />
  );
}
