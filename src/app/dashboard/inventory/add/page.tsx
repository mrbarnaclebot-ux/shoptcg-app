import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TicketLoading } from "@/components/ticket";
import { requireStore } from "@/lib/session";
import { storePricing } from "@/lib/vendor-price";
import { AddFlow } from "./add-flow";

export const metadata: Metadata = { title: "Add stock - tcgmart" };

export default function AddPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 px-4 pt-4 pb-16">
      <Link
        href="/dashboard/inventory"
        className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-muted-foreground hover:text-text"
      >
        <ChevronLeft aria-hidden className="size-4" />
        Inventory
      </Link>
      <h1 className="font-display text-[3.5rem] leading-[0.82] font-black">
        Add stock
      </h1>
      <Suspense fallback={<TicketLoading>Loading</TicketLoading>}>
        <Flow />
      </Suspense>
    </main>
  );
}

/** The store's pricing rides along so a pick shows what it will sell at. */
async function Flow() {
  const { store } = await requireStore();
  return <AddFlow pricing={storePricing(store)} />;
}
