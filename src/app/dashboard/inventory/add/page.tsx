import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AddFlow } from "./add-flow";

export const metadata: Metadata = { title: "Add stock - shoptcg" };

export default function AddPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 pt-4 pb-16">
      <Link
        href="/dashboard/inventory"
        className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-muted-foreground"
      >
        <ChevronLeft aria-hidden className="size-4" />
        Inventory
      </Link>
      <h1 className="text-2xl font-bold wdth-112">Add stock</h1>
      <AddFlow />
    </main>
  );
}
