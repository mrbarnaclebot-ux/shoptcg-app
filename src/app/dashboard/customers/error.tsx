"use client";

import { useReportError } from "@/lib/use-report-error";
import { lineButton } from "@/components/ticket-button";

export default function CustomersError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useReportError(error);
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-start gap-5 px-4 pt-8">
      <h1 className="font-display text-3xl font-black">
        Couldn&apos;t load your customers.
      </h1>
      <p className="max-w-[44ch] text-muted-foreground">
        Nothing was changed. Try again in a moment.
      </p>
      <button type="button" onClick={() => retry()} className={lineButton}>
        Try again
      </button>
    </main>
  );
}
