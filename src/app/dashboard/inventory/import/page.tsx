import { ChevronLeft, Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CSV_COLUMNS, MAX_ROWS } from "@/lib/csv-import";
import { ImportFlow } from "./import-flow";

export const metadata: Metadata = { title: "Import CSV" };

const COLUMN_HELP: Record<(typeof CSV_COLUMNS)[number], string> = {
  name: "Required. Card or product name.",
  set: "Set name, e.g. Obsidian Flames.",
  number: "Card number, e.g. 223/197.",
  language: "en, ja (or jp), zh (or cn). Default en.",
  kind: "raw, graded or sealed. Default raw.",
  condition: "Raw only: NM, LP, MP, HP, DMG. Default NM.",
  grader: "Graded only, e.g. PSA, CGC.",
  grade: "Graded only, e.g. 10 or 9.5.",
  qty: "Whole number. Default 1.",
  price: "Optional fixed price in USD. Blank follows the market.",
};

export default function ImportPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-6 px-4 pt-4 pb-16 md:px-6 lg:px-8">
      <Link
        href="/dashboard/inventory"
        className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-muted-foreground hover:text-text"
      >
        <ChevronLeft aria-hidden className="size-4" />
        Inventory
      </Link>
      <div className="flex max-w-[68ch] flex-col gap-3">
        <h1 className="font-display text-4xl font-black">Import CSV</h1>
        <p className="text-muted-foreground">
          Upload a spreadsheet of your stock, up to {MAX_ROWS} rows. You will
          see every row before anything is saved.
        </p>
        <p className="border-t border-dashed border-border-strong pt-3 text-sm text-muted-foreground">
          We match each row to the catalog; anything we can&apos;t match comes
          in as a custom item you price.
        </p>
      </div>
      <ImportFlow />
      <details className="max-w-[68ch] p-4 shadow-[inset_0_0_0_1px_var(--border-strong)]">
        <summary className="min-h-11 cursor-pointer content-center font-semibold">
          Template columns
        </summary>
        <dl className="mt-3 grid grid-cols-[7rem_1fr] gap-x-4 gap-y-2 text-sm">
          {CSV_COLUMNS.map((c) => (
            <div key={c} className="contents">
              <dt className="font-mono text-sm text-text">{c}</dt>
              <dd className="text-muted-foreground">{COLUMN_HELP[c]}</dd>
            </div>
          ))}
        </dl>
        <a
          href="/inventory-template.csv"
          download
          className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold underline decoration-brand decoration-[1.5px] underline-offset-[5px]"
        >
          <Download aria-hidden className="size-4" />
          Download the CSV template
        </a>
      </details>
    </main>
  );
}
