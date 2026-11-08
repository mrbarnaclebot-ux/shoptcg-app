import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/db";
import { slugSchema } from "@/lib/slug";
import { getStoreBySlug } from "@/lib/stores";

// Stub: the real public store page arrives in phase 4.
export default function StorePage({ params }: PageProps<"/[slug]">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6">
      <Suspense fallback={<p className="text-muted-foreground">Loading...</p>}>
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
    <h1 className="text-3xl font-semibold tracking-tight">{store.name}</h1>
  );
}
