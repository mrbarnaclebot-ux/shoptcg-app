"use client";

import Link from "next/link";
import { lineButton } from "@/components/ticket-button";

// Any page without its own error.tsx. In production the message is a digest,
// never the server's error, so nothing here can leak a stack or a secret.
export default function AppError({ retry }: { retry: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col items-start gap-5 px-4 pt-16 md:px-6 lg:px-8">
      <h1 className="font-display text-[2.5rem] leading-[0.9] font-black">
        Something went wrong.
      </h1>
      <p className="max-w-[44ch] text-muted-foreground">
        It&apos;s on our side, not yours. Try again in a moment.
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => retry()} className={lineButton}>
          Try again
        </button>
        <Link href="/" className={lineButton}>
          Go home
        </Link>
      </div>
    </main>
  );
}
