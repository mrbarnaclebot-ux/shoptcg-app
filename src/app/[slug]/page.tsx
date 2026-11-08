import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/db";
import { slugSchema } from "@/lib/slug";
import { getStoreBySlug } from "@/lib/stores";

// Stub: the real public store page arrives in phase 4.
export default function StorePage({ params }: PageProps<"/[slug]">) {
  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-4 pt-6 md:px-6 lg:px-8">
      <Suspense
        fallback={
          <div className="h-12 w-64 animate-pulse rounded-md bg-surface" />
        }
      >
        <StoreName params={params} />
      </Suspense>
    </main>
  );
}

async function StoreName({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Skip the DB for anything that could never be a store slug.
  if (!slugSchema.safeParse(slug).success) notFound();
  // Store data is live (open state, later stock), so never prerender it.
  await connection();
  const store = await getStoreBySlug(getDb(), slug);
  if (!store) notFound();
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-bold wdth-112">{store.name}</h1>
      <p
        className={`flex items-center gap-1.5 text-sm font-semibold ${store.isOpen ? "text-success" : "text-subtle"}`}
      >
        <span
          className={`size-2 rounded-full ${store.isOpen ? "bg-success" : "bg-subtle"}`}
        />
        {store.isOpen ? "Open now" : "Closed"}
      </p>
    </div>
  );
}
