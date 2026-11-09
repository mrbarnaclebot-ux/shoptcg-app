import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sales - shoptcg" };

// ponytail: placeholder tab until confirmed sales exist (Phase 6).
export default function SalesPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start gap-3 px-4 pt-8">
      <h1 className="font-display text-[3.5rem] leading-[0.82] font-black">
        Sales
      </h1>
      <p className="font-display mt-6 border-t border-dashed border-border-strong pt-5 text-[2rem] leading-none font-extrabold">
        No sales yet.
      </p>
      <p className="max-w-[44ch] text-muted-foreground">
        Confirmed sales and receipts will show up here once buyers start sending
        requests.
      </p>
    </main>
  );
}
