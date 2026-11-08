import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Inbox } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getDb } from "@/db";
import type { Store } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { getStoreByOwner } from "@/lib/stores";
import { CreateStoreForm } from "./create-store-form";

export const metadata: Metadata = { title: "Dashboard - shoptcg" };

export default function DashboardPage() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Session reads are request-time, so they stream in behind a boundary. */}
      <Suspense
        fallback={
          <div className="mx-auto mt-20 h-48 w-full max-w-lg animate-pulse rounded-lg bg-surface" />
        }
      >
        <Dashboard />
      </Suspense>
    </div>
  );
}

async function Dashboard() {
  const user = await requireUser();
  const store = await getStoreByOwner(getDb(), user.id);
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-8 px-4 pt-8 pb-16">
      {store ? (
        <>
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
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold wdth-112">Name your store</h1>
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
    <section className="flex flex-col gap-6 rounded-lg bg-surface p-5 shadow-1 ring-1 ring-border">
      <div className="flex items-center gap-4">
        <div className="grid size-12 shrink-0 place-items-center rounded-md bg-surface-2 text-lg font-extrabold text-sunrise-300 shadow-2 wdth-118">
          {initials}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold wdth-112">{store.name}</h1>
          <p
            className={`flex items-center gap-1.5 text-sm font-semibold ${store.isOpen ? "text-success" : "text-subtle"}`}
          >
            <span
              className={`size-2 rounded-full ${store.isOpen ? "bg-success" : "bg-subtle"}`}
            />
            {store.isOpen ? "Open" : "Closed"}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-1 border-t border-border pt-5">
        <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
          Public page
        </p>
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
      className="flex flex-col items-center gap-3 rounded-lg border border-border px-5 py-10 text-center"
    >
      <Inbox aria-hidden className="size-8 stroke-[1.75] text-subtle" />
      <h2 id="requests-h" className="text-xl font-bold wdth-108">
        No requests yet.
      </h2>
      <p className="max-w-[34ch] text-muted-foreground">
        When a buyer scans your table sign and sends a list, it lands here.
        While you wait, stock your shelf.
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
