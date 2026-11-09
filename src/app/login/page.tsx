import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in - shoptcg" };

export default function LoginPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="px-4 py-3 md:px-6 lg:px-8">
        <Wordmark />
      </header>
      <main className="mx-auto flex w-full max-w-[400px] flex-1 flex-col gap-8 px-4 pt-10 md:justify-center md:pt-0 md:pb-24">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold wdth-112">Sign in</h1>
          <p className="text-muted-foreground">
            We&apos;ll email you a sign-in link. No password.
          </p>
        </div>
        <LoginForm />
        <p className="text-sm text-subtle">
          New here? The same link creates your account. By signing in you agree
          to the{" "}
          <Link href="/terms" className="text-brand-text underline">
            terms
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
