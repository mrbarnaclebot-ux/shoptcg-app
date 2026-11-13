import Link from "next/link";
import { Ticket } from "@/components/ticket";
import { AuthShell, authLink } from "../login/auth-shell";
import { AskForm } from "./ask-form";
import { JoinForm } from "./join-form";

export function JoinPage({ code }: { code?: string }) {
  return (
    <AuthShell
      title="Join"
      intro="Vendor accounts are invite only. Have a code? Enter it with your email and we'll send a link to set up your account. Buyers don't need one."
      after={
        // A code link means they were invited: nothing to ask for.
        code === undefined && (
          <section aria-labelledby="ask-h" className="flex flex-col gap-3">
            <h2
              id="ask-h"
              className="font-display text-[2rem] leading-none font-black"
            >
              No code yet?
            </h2>
            <p className="text-muted-foreground">
              Tell us about your shop and we&apos;ll email you an invite.
            </p>
            <Ticket as="div" className="[--stub:2rem]">
              <AskForm />
            </Ticket>
          </section>
        )
      }
      foot={
        <>
          <p>
            Already selling here?{" "}
            <Link
              href="/login"
              className={`inline-flex min-h-11 items-center ${authLink}`}
            >
              Sign in.
            </Link>
          </p>
          <p>
            By joining you agree to the{" "}
            <Link
              href="/terms"
              className={`inline-flex min-h-11 items-center ${authLink}`}
            >
              terms
            </Link>
            .
          </p>
        </>
      }
    >
      <JoinForm code={code} />
    </AuthShell>
  );
}
