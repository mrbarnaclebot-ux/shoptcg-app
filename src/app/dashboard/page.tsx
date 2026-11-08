import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";
import { getDb } from "@/db";
import type { Store } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { getStoreByOwner } from "@/lib/stores";
import { signOutAction } from "./actions";
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
    <>
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-4 px-4 py-2 md:px-6 lg:px-8">
          <Wordmark />
          <div className="flex min-w-0 items-center gap-2">
            <p className="hidden truncate text-sm text-subtle sm:block">
              {user.email}
            </p>
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="lg">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-8 px-4 pt-10 pb-16">
        {store ? <StoreSummary store={store} /> : <NewStore />}
      </main>
    </>
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

async function StoreSummary({ store }: { store: Store }) {
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
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
