import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { metaLine } from "@/app/[slug]/tile";
import { TicketLoading } from "@/components/ticket";
import { getDb } from "@/db";
import { withLanguage } from "@/lib/format";
import { listStock } from "@/lib/listings";
import { requireStore } from "@/lib/session";
import { vendorPrice } from "@/lib/vendor-price";
import { NewEventForm } from "./new-event-form";

export const metadata: Metadata = { title: "New claim event" };

export default function NewEventPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 pt-4 pb-16">
      <Link
        href="/dashboard/events"
        className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-muted-foreground hover:text-text"
      >
        <ChevronLeft aria-hidden className="size-4" />
        Claim events
      </Link>
      <h1 className="font-display text-4xl font-black">New event</h1>
      <Suspense fallback={<TicketLoading>Counting stock</TicketLoading>}>
        <Form />
      </Suspense>
    </main>
  );
}

async function Form() {
  const { store } = await requireStore();
  if (store.sellingMode !== "online") redirect("/dashboard/events");
  const rows = await listStock(getDb(), store.id);
  const stock = rows
    .filter((r) => r.qty > 0 && !r.inEvent)
    .map((r) => ({
      id: r.id,
      name: r.name,
      meta: withLanguage(metaLine(r), r.language),
      qty: r.qty,
      price: vendorPrice(
        r.market,
        store.priceRulePct,
        Number(store.rounding),
        r.overridePrice,
      ),
    }));
  return <NewEventForm stock={stock} />;
}
