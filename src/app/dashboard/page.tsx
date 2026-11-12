import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TableNumber } from "@/components/table-number";
import { Ticket } from "@/components/ticket";
import { getDb } from "@/db";
import { appUrl } from "@/lib/deployed";
import { requireUser, sellerTimeZone } from "@/lib/session";
import { currentTill } from "@/lib/till";
import { CashBox } from "./cash-box";
import { waitingCount } from "@/lib/request-reads";
import { getStoreByOwner } from "@/lib/stores";
import { RefreshAt } from "@/components/refresh-at";
import { CreateStoreForm } from "./create-store-form";
import { CopyLink } from "./copy-link";
import { StoreControl } from "./store-control";
import { Floor } from "./requests/floor";
import { RequestQueue } from "./requests/queue";
import { StoreCreated } from "./store-created";

export const metadata: Metadata = { title: "Dashboard - shoptcg" };

export default function DashboardPage({
  searchParams,
}: PageProps<"/dashboard">) {
  return (
    <div className="flex flex-1 flex-col">
      {/* Session reads are request-time, so they stream in behind a boundary. */}
      <Suspense
        fallback={
          <div className="mx-auto mt-20 h-48 w-full max-w-lg animate-pulse bg-surface" />
        }
      >
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Dashboard({
  searchParams,
}: Pick<PageProps<"/dashboard">, "searchParams">) {
  const user = await requireUser();
  const created = "created" in (await searchParams);
  const store = await getStoreByOwner(getDb(), user.id);
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-10 px-4 pt-8 pb-16">
      {store ? (
        <>
          {created && <StoreCreated slug={store.slug} />}
          <StoreSummary
            store={store}
            waiting={await waitingCount(getDb(), store.id)}
          />
          <Till storeId={store.id} closing={store.live === "off"} />
          <RequestQueue storeId={store.id} mode={store.sellingMode} />
          <Floor slug={store.slug} />
        </>
      ) : (
        <NewStore />
      )}
    </main>
  );
}

async function Till(props: { storeId: string; closing: boolean }) {
  const [t, timeZone] = await Promise.all([
    currentTill(getDb(), props.storeId),
    sellerTimeZone(),
  ]);
  const since = t
    ? new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
        timeZone,
      }).format(t.openedAt)
    : "";
  return (
    <CashBox
      closing={props.closing}
      till={
        t && {
          id: t.id,
          since,
          float: t.openingFloat,
          cashSales: t.cashSales,
          cashBuys: t.cashBuys,
          expected: t.expected,
        }
      }
    />
  );
}

function NewStore() {
  return (
    <>
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-[3.5rem] leading-[0.82] font-black">
          Name your store
        </h1>
        <p className="text-muted-foreground">
          The link is what buyers reach from your table QR code.
        </p>
      </div>
      <Ticket as="div" className="[--stub:2rem]">
        <CreateStoreForm />
      </Ticket>
    </>
  );
}

function StoreSummary({
  store,
  waiting,
}: {
  store: NonNullable<Awaited<ReturnType<typeof getStoreByOwner>>>;
  waiting: number;
}) {
  const origin = appUrl().origin;
  const initials = store.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <section className="flex flex-col gap-5">
      <div className="grid grid-cols-[1fr_auto] items-start gap-x-4">
        <div className="min-w-0">
          <h1 className="font-display text-[2.75rem] leading-[0.88] font-black break-words">
            {store.name}
          </h1>
        </div>
        <TableNumber label="Store" value={initials} />
      </div>
      {store.suspendedAt ? (
        <section
          aria-label="Your store"
          className="flex flex-col gap-1 px-5 py-4 shadow-[inset_0_0_0_1.5px_var(--border-strong)]"
        >
          <h2 className="font-display text-[2rem] leading-none font-black">
            Stopped by an admin
          </h2>
          <p className="text-sm text-muted-foreground">
            Your page shows no stock and buyers can&apos;t send requests. Ask
            the person who invited you.
          </p>
        </section>
      ) : (
        <StoreControl
          live={store.live}
          resumesInMin={store.resumesInMin}
          autoPaused={store.autoPaused}
          waiting={waiting}
        />
      )}
      <RefreshAt inMs={store.changesInMs} />
      <div className="flex flex-col gap-1 border-t border-border pt-4">
        <p className="text-sm text-muted-foreground">Your public page</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* Shown like the table sign: no protocol, in the poster face. */}
          <Link
            href={`/${store.slug}`}
            className="font-display inline-flex min-h-11 items-center text-2xl font-extrabold break-all underline decoration-brand decoration-[1.5px] underline-offset-[5px]"
          >
            {origin.replace(/^https?:\/\//, "")}/{store.slug}
          </Link>
          <CopyLink url={`${origin}/${store.slug}`} />
          <Link
            href="/dashboard/preview"
            className="inline-flex min-h-11 items-center text-sm font-semibold underline decoration-brand decoration-[1.5px] underline-offset-[5px]"
          >
            Preview
          </Link>
        </div>
      </div>
    </section>
  );
}
