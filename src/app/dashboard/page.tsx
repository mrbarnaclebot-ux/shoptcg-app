import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TableNumber } from "@/components/table-number";
import { Ticket } from "@/components/ticket";
import { getDb } from "@/db";
import { appUrl } from "@/lib/deployed";
import { hasPassword } from "@/lib/password";
import { requireUser, sellerTimeZone } from "@/lib/session";
import { currentTill } from "@/lib/till";
import { CashBox } from "./cash-box";
import { waitingCount } from "@/lib/request-reads";
import { getStoreByOwner } from "@/lib/stores";
import { RefreshAt } from "@/components/refresh-at";
import {
  bentoColumn,
  bentoLeft,
  bentoPage,
  bentoRight,
} from "@/components/bento";
import { CreateStoreForm } from "./create-store-form";
import { CopyLink } from "./copy-link";
import { GettingStarted } from "./getting-started";
import { StoreControl } from "./store-control";
import { Floor } from "./requests/floor";
import { RequestQueue } from "./requests/queue";
import { StoreCreated } from "./store-created";

export const metadata: Metadata = { title: "Dashboard - tcgmart" };

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
  const [store, passworded] = await Promise.all([
    getStoreByOwner(getDb(), user.id),
    hasPassword(getDb(), user.id),
  ]);
  const banner = !passworded && (
    <section
      aria-label="Set a password"
      className="flex flex-col gap-2 bg-surface px-5 py-4 lg:col-span-2 lg:mb-6"
    >
      <p className="font-semibold">
        Set a password so you can sign in without an email link.
      </p>
      <Link
        href="/welcome"
        className="self-start text-sm font-semibold underline decoration-brand decoration-[1.5px] underline-offset-[5px]"
      >
        Set password
      </Link>
    </section>
  );
  if (!store)
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-10 px-4 pt-8 pb-16">
        {banner}
        <NewStore />
      </main>
    );
  // Desktop: the store and its requests on the left, the boxes you glance at
  // on the right. A phone keeps one stack in the order below (order-*).
  return (
    <main
      className={`mx-auto flex w-full max-w-xl flex-1 flex-col gap-10 px-4 pt-8 pb-16 lg:max-w-[1280px] lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:px-8 ${bentoPage}`}
    >
      {banner}
      {created && (
        <div className="lg:col-span-2 lg:mb-6">
          <StoreCreated slug={store.slug} />
        </div>
      )}
      <div className={`${bentoColumn} ${bentoLeft}`}>
        <div className="order-1 lg:order-none">
          <StoreSummary
            store={store}
            waiting={await waitingCount(getDb(), store.id)}
          />
        </div>
        <div className="order-4 lg:order-none">
          <RequestQueue storeId={store.id} mode={store.sellingMode} />
        </div>
      </div>
      <div className={`${bentoColumn} ${bentoRight}`}>
        <div className="order-3 lg:order-none">
          <Till storeId={store.id} closing={store.live === "off"} />
        </div>
        <div className="order-5 lg:order-none">
          <Floor slug={store.slug} />
        </div>
        {!store.tipsDismissedAt && (
          <div className="order-2 lg:order-none">
            <GettingStarted store={store} />
          </div>
        )}
      </div>
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
          Your store&apos;s address: the link you share online and the QR on
          your table sign.
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
