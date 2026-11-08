import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Inbox } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getDb } from "@/db";
import type { Store } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { getStoreByOwner } from "@/lib/stores";
import { SlabHead } from "@/components/slab-head";
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
          <div className="mx-auto mt-20 h-48 w-full max-w-lg animate-pulse rounded-lg bg-surface" />
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
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-8 px-4 pt-8 pb-16">
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
        <p className="eyebrow self-start">Step 1 of 1</p>
        <h1 className="text-3xl font-extrabold wdth-125">Name your store</h1>
        <p className="text-muted-foreground">
          The link is what buyers reach from your table QR code.
        </p>
      </div>
      <CreateStoreForm />
    </>
  );
}

function StoreSummary({ store }: { store: Store }) {
  // Request headers are client-controlled; the configured origin is not.
  const origin = (process.env.BETTER_AUTH_URL ?? "").replace(/\/$/, "");
  const initials = store.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <section className="flex flex-col rounded-sm bg-surface ring-1 ring-border">
      <div className="flex items-center gap-4 border-b border-border p-5">
        <div className="grid size-12 shrink-0 place-items-center rounded-sm bg-seal-50 text-lg font-black text-galaxy-950 wdth-118">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-extrabold wdth-118">
            {store.name}
          </h1>
          <p
            className={`flex items-center gap-1.5 text-xs font-bold tracking-[0.14em] uppercase ${store.isOpen ? "text-success" : "text-subtle"}`}
          >
            <span
              aria-hidden
              className={
                store.isOpen ? "live-dot" : "size-1.5 rounded-full bg-subtle"
              }
            />
            {store.isOpen ? "Open" : "Closed"}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-1 p-5">
        <SlabHead meta={`/${store.slug}`}>Public page</SlabHead>
        <Link
          href={`/${store.slug}`}
          className="inline-flex min-h-11 items-center break-all text-brand-text underline underline-offset-4"
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
    <section
      aria-labelledby="requests-h"
      className="flex flex-col items-center gap-3 rounded-sm border border-dashed border-border-strong px-5 py-10 text-center"
    >
      <Inbox aria-hidden className="size-8 stroke-[1.75] text-subtle" />
      <h2 id="requests-h" className="text-xl font-bold wdth-108">
        <span className="num">0</span> requests logged.
      </h2>
      <p className="max-w-[34ch] text-muted-foreground">
        A buyer scans your table sign, picks and requests; it lands here. Stock
        your table first.
      </p>
      <Link
        href="/dashboard/inventory"
        className={buttonVariants({ size: "lg", variant: "secondary" })}
      >
        Go to inventory
      </Link>
    </section>
  );
}
