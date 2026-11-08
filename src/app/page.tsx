import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { SlabHead } from "@/components/slab-head";
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
    <div className="lab-grid flex flex-1 flex-col overflow-x-clip">
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
            <p className="eyebrow self-start">
              <span aria-hidden className="live-dot" />
              Market sync nightly
            </p>
            <h1 className="text-[2.75rem] leading-[0.96] font-extrabold tracking-[-0.02em] wdth-125 md:text-[clamp(3.5rem,6.4vw,5rem)]">
              Priced to the cent.{" "}
              <span className="block text-[0.86em] font-semibold tracking-normal text-muted-foreground wdth-72">
                Raw, graded, sealed.
              </span>
            </h1>
            <p className="max-w-[44ch] text-lg text-muted-foreground">
              Every item on your table carries a live market price and your rule
              on top. Buyers scan, pick and request. You confirm; the receipt
              files itself.
            </p>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-5">
              <Link
                href="/login"
                className={buttonVariants({
                  size: "lg",
                  className: "w-full rounded-sm md:w-auto",
                })}
              >
                Create your store
              </Link>
              <p className="num text-sm font-semibold text-subtle">
                50 items in under 15 min
              </p>
            </div>
          </div>
          <div className="relative isolate py-6 md:py-4">
            <div
              aria-hidden
              className="ruler-y absolute top-[8%] right-0 bottom-[8%] hidden md:block"
            />
            <div
              aria-hidden="true"
              className="hero-sky absolute inset-x-[-25%] inset-y-[-10%] -z-10"
            />
            <PhonePreview />
          </div>
        </section>

        <section aria-labelledby="how-it-works" className="py-12 md:py-16">
          <SlabHead id="how-it-works" meta="3 steps">
            How it works
          </SlabHead>
          <ol className="mt-6 grid gap-8 md:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="num text-xl text-brand-text wdth-72">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-base">
                  <span className="font-semibold">{step.title}</span>{" "}
                  <span className="text-muted-foreground">{step.body}</span>
                </p>
              </li>
            ))}
          </ol>
          <ul className="mt-12 flex flex-wrap gap-x-6 gap-y-2 text-xs font-bold tracking-[0.1em] text-subtle uppercase">
            {proof.map((p) => (
              <li key={p} className="border-l border-border-strong pl-2">
                {p}
              </li>
            ))}
          </ul>
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
