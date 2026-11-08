import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDb } from "@/db";
import type { Store } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { getStoreByOwner } from "@/lib/stores";
import { signOutAction } from "./actions";
import { CreateStoreForm } from "./create-store-form";

export const metadata: Metadata = { title: "Dashboard - shoptcg" };

export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-6 py-10">
      {/* Session reads are request-time, so they stream in behind a boundary. */}
      <Suspense fallback={<p className="text-muted-foreground">Loading...</p>}>
        <Dashboard />
      </Suspense>
    </main>
  );
}

async function Dashboard() {
  const user = await requireUser();
  const store = await getStoreByOwner(getDb(), user.id);
  return (
    <>
      <header className="flex items-center justify-between gap-4">
        <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        <form action={signOutAction}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </header>
      {store ? <StoreSummary store={store} /> : <NewStore />}
    </>
  );
}

function NewStore() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Create your store</h1>
        </CardTitle>
        <CardDescription>
          The address is what buyers reach from your table QR code.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CreateStoreForm />
      </CardContent>
    </Card>
  );
}

async function StoreSummary({ store }: { store: Store }) {
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>{store.name}</h1>
        </CardTitle>
        <CardDescription>{store.isOpen ? "Open" : "Closed"}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Public page</p>
        <Link
          href={`/${store.slug}`}
          className="break-all text-primary underline"
        >
          {origin}/{store.slug}
        </Link>
      </CardContent>
    </Card>
  );
}
