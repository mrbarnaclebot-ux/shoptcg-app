import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getDb } from "@/db";
import { hasPassword } from "@/lib/password";
import { requireUser } from "@/lib/session";
import { AuthShell } from "../login/auth-shell";
import { WelcomeForm } from "./welcome-form";

export const metadata: Metadata = {
  title: "Welcome",
  robots: { index: false },
};

export default function WelcomePage() {
  return (
    <AuthShell
      title="Welcome"
      intro="Choose a password. Next time, sign in with your email and this password."
      foot={null}
      signIn={false}
    >
      {/* The session is request data, so the check streams in. */}
      <Suspense fallback={<div className="h-64" />}>
        <Gate />
      </Suspense>
    </AuthShell>
  );
}

async function Gate() {
  const user = await requireUser();
  if (await hasPassword(getDb(), user.id)) redirect("/dashboard");
  return <WelcomeForm email={user.email} />;
}
