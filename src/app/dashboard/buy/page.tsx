import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireStore } from "@/lib/session";
import { storePricing } from "@/lib/vendor-price";
import { BuyForm } from "./buy-form";

export const metadata: Metadata = { title: "Buy" };

export default function BuyPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 px-4 pt-4 pb-16">
      <Link
        href="/dashboard/inventory"
        className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-muted-foreground hover:text-text"
      >
        <ChevronLeft aria-hidden className="size-4" />
        Inventory
      </Link>
      <h1 className="font-display text-4xl font-black">Buy</h1>
      <p className="text-muted-foreground">
        Cards you bought or took in trade. They go into stock, and what you paid
        becomes their cost. Search the catalog to see the market price.
      </p>
      <Suspense
        fallback={
          <p role="status" className="py-10 font-semibold text-subtle">
            Loading...
          </p>
        }
      >
        <Form />
      </Suspense>
    </main>
  );
}

// The stock picker searches the server, so a big store finds any item.
async function Form() {
  const { store } = await requireStore();
  return <BuyForm pricing={storePricing(store)} />;
}
