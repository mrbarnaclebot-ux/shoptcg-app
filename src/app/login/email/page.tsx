import type { Metadata } from "next";
import { AuthShell } from "../auth-shell";
import { ConfirmEmail } from "./confirm-email";

export const metadata: Metadata = {
  title: "Confirm email",
  robots: { index: false },
  // The token is in the URL: never pass it on as a referrer.
  referrer: "no-referrer",
};

export default function ConfirmEmailPage() {
  return (
    <AuthShell
      title="New email"
      intro="Confirm this address to sign in with it from now on."
      foot={null}
    >
      <ConfirmEmail />
    </AuthShell>
  );
}
