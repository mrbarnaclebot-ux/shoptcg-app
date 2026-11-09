import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { lineButton } from "@/components/ticket-button";
import { SectionMark } from "@/components/section-mark";
import { TableNumber } from "@/components/table-number";
import { Ticket } from "@/components/ticket";
import { getDb } from "@/db";
import type { Store } from "@/db/schema";
import { appUrl } from "@/lib/deployed";
import { requireUser } from "@/lib/session";
import { getStoreByOwner } from "@/lib/stores";
import { CreateStoreForm } from "./create-store-form";
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
          <StoreSummary store={store} />
          <RequestsEmpty />
        </>
      ) : (
        <NewStore />
      )}
    </main>
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

function StoreSummary({ store }: { store: Store }) {
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
          <p
            className={`mt-2 flex items-center gap-1.5 text-sm font-semibold ${store.isOpen ? "text-success" : "text-muted-foreground"}`}
          >
            <span aria-hidden className="size-[7px] rounded-full bg-current" />
            {store.isOpen ? "Open" : "Closed"}
          </p>
        </div>
        <TableNumber label="Store" value={initials} />
      </div>
      <div className="flex flex-col gap-1 border-t border-border pt-4">
        <p className="text-sm text-muted-foreground">Your public page</p>
        <Link
          href={`/${store.slug}`}
          className="inline-flex min-h-11 items-center font-semibold break-all underline decoration-brand decoration-[1.5px] underline-offset-[5px]"
        >
          {origin}/{store.slug}
        </Link>
      </div>
    </section>
  );
}

// ponytail: static until the Phase 5 request queue exists.
function RequestsEmpty() {
  return (
    <section aria-labelledby="requests-h" className="flex flex-col gap-3">
      <SectionMark n={1} id="requests-h">
        Requests
      </SectionMark>
      <div className="flex flex-col items-start gap-3 border-t border-dashed border-border-strong pt-5">
        <p className="font-display text-[2rem] leading-none font-extrabold">
          No requests yet.
        </p>
        <p className="max-w-[44ch] text-muted-foreground">
          When a buyer scans your table sign and sends a list, it lands here and
          your phone chimes. Stock your table first.
        </p>
        <div className="mt-1 flex flex-wrap gap-3">
          <Link href="/dashboard/inventory" className={lineButton}>
            Go to inventory
          </Link>
          <Link href="/dashboard/sign" className={lineButton}>
            Print table sign
          </Link>
        </div>
      </div>
    </section>
  );
}
