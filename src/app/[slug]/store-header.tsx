import Link from "next/link";
import { RefreshAt } from "@/components/refresh-at";
import { TableNumber } from "@/components/table-number";
import { shortDate } from "@/lib/format";
import { modeCopy } from "@/lib/selling-mode";
import type { PublicStore } from "@/lib/storefront";

const STATUS = { open: "Open", paused: "Paused", off: "Not vending" } as const;

/** The QR sign still lands here, so it says who they are and where, just no stock. */
export function NotVending({ store }: { store: PublicStore }) {
  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-4 md:px-6 lg:px-8">
      <StoreHeader store={store} />
      <RefreshAt inMs={null} everyMs={60_000} />
      <p className="max-w-[32ch] py-12 text-lg text-balance">
        {store.name} isn&apos;t vending right now.{" "}
        {modeCopy(store.sellingMode).notVending}
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
  // A store with no images keeps exactly the header it always had.
  const art = Boolean(store.bannerUrl || store.avatarUrl);
  return (
    <>
      {store.bannerUrl && (
        // Edge to edge on a phone. Already 1500 x 500 WebP, so no optimiser pass.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={store.bannerUrl}
          alt=""
          width={1500}
          height={500}
          fetchPriority="high"
          className={`-mx-4 block aspect-[3/1] w-[calc(100%+2rem)] max-w-none bg-surface object-cover md:mx-0 md:mt-6 md:w-full lg:aspect-[4/1] ${store.state === "off" ? "grayscale" : ""}`}
        />
      )}
      {store.avatarUrl && (
        // A square print on paper stock, set two degrees off true like the stamps.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={store.avatarUrl}
          alt=""
          width={400}
          height={400}
          className={`relative z-[1] size-[72px] -rotate-2 border-4 border-[var(--paper)] bg-surface object-cover lg:size-28 ${store.bannerUrl ? "-mt-9 ml-1 lg:-mt-14" : "mt-6 md:mt-10"}`}
        />
      )}
      <StoreTitle {...props} tight={art} />
    </>
  );
}

function StoreTitle(props: {
  store: PublicStore;
  items?: number;
  updatedOn?: string | null;
  tight: boolean;
}) {
  const { store } = props;
  return (
    <header
      className={`grid grid-cols-[1fr_auto] items-start gap-x-4 gap-y-2 pb-4 ${props.tight ? "pt-4" : "pt-6 md:pt-10"}`}
    >
      <h1 className="font-display text-[2.5rem] leading-[0.9] font-black text-balance md:text-[4rem]">
        {store.name}
      </h1>
      {store.tableLabel && modeCopy(store.sellingMode).showTable && (
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
