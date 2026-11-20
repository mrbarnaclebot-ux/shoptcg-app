import { Suspense } from "react";
import { bento } from "@/components/bento";
import { lineButton } from "@/components/ticket-button";
import { requireUser } from "@/lib/session";
import { ChangeEmail, DeleteAccount } from "./account-forms";
import { ChangePassword } from "./change-password";
import { SignOut } from "./sign-out";

/** Sign out, password and email, with Delete account last behind a disclosure. */
export function AccountBlock({ className = "flex" }: { className?: string }) {
  return (
    <main className={`${className} flex-col gap-8`}>
      <h1 className="font-display text-[3.5rem] leading-[0.82] font-black">
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
      </div>
      <DeleteAccount />
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
