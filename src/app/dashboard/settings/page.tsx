import type { Metadata } from "next";
import { Suspense } from "react";
import { bento } from "@/components/bento";
import { lineButton } from "@/components/ticket-button";
import { requireUser } from "@/lib/session";
import { ChangeEmail, DeleteAccount } from "./account-forms";
import { ChangePassword } from "./change-password";
import { SignOut } from "./sign-out";

export const metadata: Metadata = { title: "More - tcgmart" };

// The menu comes from the layout; this page is the account block under it.
export default function AccountPage() {
  return (
    <main className="flex flex-col gap-4">
      <h1 className="lg:font-display text-lg font-semibold lg:text-[3.5rem] lg:leading-[0.82] lg:font-black">
        Account
      </h1>
      <div className={bento}>
        <div className="flex flex-col gap-4">
          <Suspense fallback={<div className="h-6 animate-pulse bg-surface" />}>
            <SignedInAs />
          </Suspense>
          <SignOut className={lineButton} />
        </div>
        <ChangePassword />
        <ChangeEmail />
        <DeleteAccount />
      </div>
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
