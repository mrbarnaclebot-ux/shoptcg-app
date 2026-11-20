"use client";

import { useReportError } from "@/lib/use-report-error";
import { lineButton } from "@/components/ticket-button";

export default function StoreError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useReportError(error);
  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col items-start gap-5 px-4 pt-16 md:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-black">
        This page didn&apos;t load.
      </h1>
      <p className="max-w-[44ch] text-muted-foreground">
        It&apos;s on our side, not yours. Try again in a moment.
      </p>
      <button type="button" onClick={() => retry()} className={lineButton}>
        Try again
      </button>
    </main>
  );
}
