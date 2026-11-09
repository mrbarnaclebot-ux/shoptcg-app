import type { Metadata } from "next";
import { getImageProps } from "next/image";
import Link from "next/link";
import { Ticket } from "@/components/ticket";
import { Wordmark } from "@/components/wordmark";
import table from "../../../public/media/table.jpg";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in - shoptcg" };

export default function LoginPage() {
  return (
    <div className="grid flex-1 md:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
      <figure className="grain relative hidden md:block">
        {/* getImageProps: no client image component in the login bundle. */}
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- alt is in the props */}
        <img
          {...getImageProps({
            src: table,
            alt: "A vendor table under a clamp lamp: toploaders in rows, slabs and a cash box",
            sizes: "50vw",
          }).props}
          className="absolute inset-0 size-full object-cover"
        />
        <figcaption className="absolute bottom-6 left-6 z-[3] bg-night/80 px-3 py-2 text-[0.8125rem] text-muted-foreground">
          <b className="font-semibold text-text">7:40 AM.</b> Doors open at
          nine. The table is already priced.
        </figcaption>
      </figure>
      <div className="flex flex-col px-4 md:px-12">
        <header className="py-2 md:py-6">
          <Wordmark />
        </header>
        <main className="flex w-full max-w-[440px] flex-1 flex-col gap-7 pt-8 md:justify-center md:pt-0 md:pb-24">
          <div className="flex flex-col gap-3">
            <h1 className="font-display text-[4rem] leading-[0.82] font-black">
              Sign in
            </h1>
            <p className="text-muted-foreground">
              We&apos;ll email you a sign-in link. No password.
            </p>
          </div>
          <Ticket as="div" className="[--stub:2rem]">
            <LoginForm />
          </Ticket>
          <p className="text-sm text-muted-foreground">
            New here? The same link creates your account. By signing in you
            agree to the{" "}
            <Link
              href="/terms"
              className="text-text underline decoration-brand decoration-[1.5px] underline-offset-4"
            >
              terms
            </Link>
            .
          </p>
        </main>
      </div>
    </div>
  );
}
