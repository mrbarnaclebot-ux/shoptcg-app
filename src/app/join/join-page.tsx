import Link from "next/link";
import { AuthShell, authLink } from "../login/auth-shell";
import { JoinForm } from "./join-form";

export function JoinPage({ code }: { code?: string }) {
  return (
    <AuthShell
      title="Join"
      intro="Vendor accounts are invite only. Buyers don't need one."
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
