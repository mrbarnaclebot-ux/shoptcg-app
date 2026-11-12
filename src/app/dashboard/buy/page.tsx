import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getDb } from "@/db";
import { gradeLabel } from "@/lib/format";
import { listStock } from "@/lib/listings";
import { requireStore } from "@/lib/session";
import { BuyForm } from "./buy-form";

export const metadata: Metadata = { title: "Buy - shoptcg" };

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
      <h1 className="font-display text-[3.5rem] leading-[0.82] font-black">
        Buy
      </h1>
      <p className="text-muted-foreground">
        Cards you bought or took in trade. They go into stock, and what you paid
        becomes their cost.
      </p>
      <Suspense
        fallback={
          <p role="status" className="py-10 font-semibold text-subtle">
            Counting stock...
          </p>
        }
      >
        <Stock />
      </Suspense>
    </main>
  );
}

async function Stock() {
  const { store } = await requireStore();
  const db = getDb();
  const rows = [
    ...(await listStock(db, store.id)),
    ...(await listStock(db, store.id, { kind: "hidden" })),
  ];
  return (
    <BuyForm
      stock={rows.map((r) => ({
        id: r.id,
        name: r.name,
        meta: [gradeLabel(r), r.setName, r.number && `#${r.number}`]
          .filter(Boolean)
          .join(" · "),
        qty: r.qty,
      }))}
    />
  );
}
