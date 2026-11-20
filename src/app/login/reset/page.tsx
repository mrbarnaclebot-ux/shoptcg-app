import type { Metadata } from "next";
import { AuthShell } from "../auth-shell";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = {
  title: "New password",
  robots: { index: false },
  // The token is in the URL: never pass it on as a referrer.
  referrer: "no-referrer",
};

export default function ResetPage() {
  return (
    <AuthShell
      title="New password"
      intro="Choose a password. You'll use it with your email to sign in."
      foot={null}
    >
      <ResetForm />
    </AuthShell>
  );
}
