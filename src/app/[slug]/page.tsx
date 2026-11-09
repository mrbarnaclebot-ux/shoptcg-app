import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/db";
import { slugSchema } from "@/lib/slug";
import { getStoreBySlug } from "@/lib/stores";

// Stub: the real public store page arrives in phase 4.
export default function StorePage({ params }: PageProps<"/[slug]">) {
  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-4 pt-8 md:px-6 lg:px-8">
      <Suspense
        fallback={<div className="h-12 w-64 animate-pulse bg-surface" />}
      >
        <StoreName params={params} />
      </Suspense>
    </main>
  );
}

// ponytail: notFound() inside Suspense streams after the 200 status is sent, so
// unknown slugs are a soft 404. Phase 4 moves the lookup above the boundary.
async function StoreName({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Skip the DB for anything that could never be a store slug.
  if (!slugSchema.safeParse(slug).success) notFound();
  // Store data is live (open state, later stock), so never prerender it.
  await connection();
  const store = await getStoreBySlug(getDb(), slug);
  if (!store) notFound();
  return (
    <header className="flex flex-col gap-3">
      <h1 className="font-display text-[2.75rem] leading-[0.88] font-black md:text-[4rem]">
        {store.name}
      </h1>
      <p
        className={`flex items-center gap-1.5 text-sm font-semibold ${store.isOpen ? "text-success" : "text-muted-foreground"}`}
      >
        <span aria-hidden className="size-[7px] rounded-full bg-current" />
        {store.isOpen ? "Open" : "Closed"}
      </p>
      <p className="max-w-[44ch] text-muted-foreground">
        This table is still setting up. Ask the seller, or check back soon.
      </p>
    </header>
  );
}
