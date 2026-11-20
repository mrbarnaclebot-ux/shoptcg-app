import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell, authLink } from "./auth-shell";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthShell
      title="Sign in"
      signIn={false}
      foot={
        <>
          <p>
            New vendor?{" "}
            <Link
              href="/join"
              className={`inline-flex min-h-11 items-center ${authLink}`}
            >
              Use an invite code or ask for one.
            </Link>
          </p>
          <p>
            By signing in you agree to the{" "}
            <Link
              href="/terms"
              className={`inline-flex min-h-11 items-center ${authLink}`}
            >
              terms
            </Link>
            .
          </p>
          {/* Only accounts from before passwords need this, so it sits last. */}
          <p className="mt-2">
            Signed in with email links before? Use Forgot password once to
            choose a password.
          </p>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
