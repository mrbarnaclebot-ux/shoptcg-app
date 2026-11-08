import { ReceiptText } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sales - shoptcg" };

// ponytail: placeholder tab until confirmed sales exist (Phase 6).
export default function SalesPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center gap-3 px-4 pt-16 text-center">
      <ReceiptText aria-hidden className="size-8 stroke-[1.75] text-subtle" />
      <h1 className="text-2xl font-bold wdth-112">No sales yet.</h1>
      <p className="max-w-[34ch] text-muted-foreground">
        Confirmed sales and receipts will show up here once buyers start sending
        requests.
      </p>
    </main>
  );
}
