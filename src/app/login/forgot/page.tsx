import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell, authLink } from "../auth-shell";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = {
  title: "Set a password - tcgmart",
  robots: { index: false },
};

export default function ForgotPage() {
  return (
    <AuthShell
      title="Set a password"
      intro="Forgot it, or never set one? We'll email you a link to choose a new password."
      foot={
        <p>
          Remembered it?{" "}
          <Link
            href="/login"
            className={`inline-flex min-h-11 items-center ${authLink}`}
          >
            Sign in.
          </Link>
        </p>
      }
    >
      <ForgotForm />
    </AuthShell>
  );
}
