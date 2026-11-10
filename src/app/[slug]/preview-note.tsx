"use client";

import { useSyncExternalStore } from "react";

const never = () => () => {};

/**
 * A strip above the store while its owner previews it. Inside the dashboard's
 * preview frame the dashboard already says so, so it stays hidden there.
 */
export function PreviewNote({ seen }: { seen: string }) {
  const framed = useSyncExternalStore(
    never,
    () => window.top !== window.self,
    () => true,
  );
  if (framed) return null;
  return (
    <p className="flex flex-wrap items-center justify-center gap-x-3 bg-brand px-4 py-2 text-sm font-semibold text-on-brand">
      <span>Preview of your store when open. Right now {seen}</span>
      {/* A plain link: the route clears the cookie, so it must not be prefetched. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/dashboard/preview/exit"
        className="underline underline-offset-4"
      >
        Exit preview
      </a>
    </p>
  );
}
