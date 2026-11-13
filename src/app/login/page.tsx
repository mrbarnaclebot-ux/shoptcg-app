import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell, authLink } from "./auth-shell";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in - tcgmart" };

export default function LoginPage() {
  return (
    <AuthShell
      title="Sign in"
      intro="Used email links before? Tap Forgot password once to set one."
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
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
