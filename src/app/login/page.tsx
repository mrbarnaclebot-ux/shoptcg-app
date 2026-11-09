import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell, authLink } from "./auth-shell";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in - shoptcg" };

export default function LoginPage() {
  return (
    <AuthShell
      title="Sign in"
      intro="We'll email you a sign-in link. No password."
      foot={
        <>
          <p>
            New vendor?{" "}
            <Link
              href="/join"
              className={`inline-flex min-h-11 items-center ${authLink}`}
            >
              Use your invite code.
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
