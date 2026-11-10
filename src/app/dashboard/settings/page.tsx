import type { Metadata } from "next";
import { Suspense } from "react";
import { lineButton } from "@/components/ticket-button";
import { requireUser } from "@/lib/session";
import { SignOut } from "./sign-out";

export const metadata: Metadata = { title: "More - shoptcg" };

// The menu comes from the layout; this page is the account block under it.
export default function AccountPage() {
  return (
    <main className="flex flex-col gap-4">
      <h1 className="lg:font-display text-lg font-semibold lg:text-[3.5rem] lg:leading-[0.82] lg:font-black">
        Account
      </h1>
      <Suspense fallback={<div className="h-6 animate-pulse bg-surface" />}>
        <SignedInAs />
      </Suspense>
      <SignOut className={lineButton} />
    </main>
  );
}

async function SignedInAs() {
  const user = await requireUser();
  return (
    <p className="text-sm text-muted-foreground">
      Signed in as{" "}
      <span className="[overflow-wrap:anywhere]">{user.email}</span>
    </p>
  );
}
