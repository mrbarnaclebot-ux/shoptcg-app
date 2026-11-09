import Link from "next/link";
import { RefreshAt } from "@/components/refresh-at";
import { TableNumber } from "@/components/table-number";
import { shortDate } from "@/lib/format";
import type { PublicStore } from "@/lib/storefront";

const STATUS = { open: "Open", paused: "Paused", off: "Not vending" } as const;

/** The QR sign still lands here, so it says who they are and where, just no stock. */
export function NotVending({ store }: { store: PublicStore }) {
  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-4 md:px-6 lg:px-8">
      <StoreHeader store={store} />
      <RefreshAt inMs={null} everyMs={60_000} />
      <p className="max-w-[32ch] py-12 text-lg text-balance">
        {store.name} isn&apos;t vending right now. Check back at their next
        show.
      </p>
      <footer className="mt-auto border-t border-border pt-4 pb-16 text-xs text-muted-foreground">
        <Link href="/terms" className="underline underline-offset-2">
          Terms
        </Link>
      </footer>
    </main>
  );
}

export function StoreHeader(props: {
  store: PublicStore;
  items?: number;
  updatedOn?: string | null;
}) {
  const { store } = props;
  return (
    <header className="grid grid-cols-[1fr_auto] items-start gap-x-4 gap-y-2 pt-6 pb-4 md:pt-10">
      <h1 className="font-display text-[2.5rem] leading-[0.9] font-black text-balance md:text-[4rem]">
        {store.name}
      </h1>
      {store.tableLabel && (
        <TableNumber
          label="Table"
          value={store.tableLabel}
          className="row-span-2"
        />
      )}
      <p className="text-sm leading-snug text-muted-foreground">
        <span
          className={`inline-flex items-center gap-1.5 font-semibold ${store.isOpen ? "text-success" : "text-text"}`}
        >
          <span aria-hidden className="size-[7px] rounded-full bg-current" />
          {STATUS[store.state]}
        </span>
        {props.items !== undefined && (
          <>
            <br />
            <span className="num">{props.items}</span>{" "}
            {props.items === 1 ? "item" : "items"}.
            {props.updatedOn &&
              ` Prices updated ${shortDate(props.updatedOn)}.`}
          </>
        )}
      </p>
    </header>
  );
}
