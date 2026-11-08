import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";
import { PhonePreview } from "./phone-preview";

const steps = [
  {
    title: "Add your stock.",
    body: "Search by name or number, or import a CSV.",
  },
  {
    title: "Print your table sign.",
    body: "One QR, A5, any printer.",
  },
  {
    title: "Sell at the table.",
    body: "Requests ping your phone; confirm and the receipt emails itself.",
  },
];

const proof = [
  "Nightly price sync",
  "Raw, graded and sealed",
  "EN, JP and CN",
  "Your own FX rate",
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col overflow-x-clip">
      <header className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-4 py-3 md:px-6 lg:px-8">
        <Wordmark />
        <Link
          href="/login"
          className={buttonVariants({ variant: "ghost", size: "lg" })}
        >
          Vendor sign in
        </Link>
      </header>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 md:px-6 lg:px-8">
        <section className="grid items-center gap-12 pt-8 pb-16 md:grid-cols-2 md:gap-8 md:pt-0 md:pb-16 lg:grid-cols-[1.1fr_1fr]">
          <div className="flex flex-col gap-6">
            <h1 className="text-[2.5rem] leading-[2.75rem] font-extrabold wdth-118 md:text-[clamp(3.25rem,6vw,4.75rem)] md:leading-[0.98]">
              Your table, <span className="block">priced live.</span>
            </h1>
            <p className="max-w-[46ch] text-lg text-muted-foreground">
              List your Pokemon cards, slabs and sealed with market prices.
              Buyers scan your QR, pick what they want and ping you. You confirm
              at the table.
            </p>
            <div>
              <Link
                href="/login"
                className={buttonVariants({
                  size: "lg",
                  className: "w-full md:w-auto",
                })}
              >
                Create your store
              </Link>
            </div>
          </div>
          <div className="relative isolate py-6 md:py-4">
            <div
              aria-hidden="true"
              className="hero-sky absolute inset-x-[-25%] inset-y-[-10%] -z-10"
            />
            <PhonePreview />
          </div>
        </section>

        <section
          aria-labelledby="how-it-works"
          className="border-t border-border py-12 md:py-16"
        >
          <h2
            id="how-it-works"
            className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase"
          >
            How it works
          </h2>
          <ol className="mt-6 grid gap-8 md:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="num text-xl text-brand-text">{i + 1}</span>
                <p className="text-base">
                  <span className="font-semibold">{step.title}</span>{" "}
                  <span className="text-muted-foreground">{step.body}</span>
                </p>
              </li>
            ))}
          </ol>
          <p className="mt-12 text-sm text-subtle">{proof.join(" · ")}</p>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-2 px-4 py-6 text-sm text-subtle md:flex-row md:items-center md:justify-between md:px-6 lg:px-8">
          <Link
            href="/terms"
            className="inline-flex min-h-11 items-center hover:text-foreground"
          >
            Terms
          </Link>
          <p>
            Not affiliated with Nintendo, Creatures, GAME FREAK or The Pokemon
            Company.
          </p>
        </div>
      </footer>
    </div>
  );
}
