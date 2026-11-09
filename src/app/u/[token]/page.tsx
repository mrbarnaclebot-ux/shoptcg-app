import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { getDb } from "@/db";
import { customer, store } from "@/db/schema";
import { TicketButton } from "@/components/ticket-button";
import { UNSUB_TOKEN } from "@/lib/sales";
import { unsubscribe } from "./actions";

export const instant = false;

export const metadata: Metadata = {
  title: "Unsubscribe - shoptcg",
  robots: { index: false },
};

async function storeName(token: string) {
  if (!UNSUB_TOKEN.test(token)) return null;
  const [row] = await getDb()
    .select({ name: store.name })
    .from(customer)
    .innerJoin(store, eq(store.id, customer.storeId))
    .where(eq(customer.unsubscribeToken, token));
  return row?.name ?? null;
}

// GET only asks: a link scanner opening this page must not unsubscribe anyone.
export default async function UnsubscribePage({
  params,
  searchParams,
}: PageProps<"/u/[token]">) {
  const { token } = await params;
  const done = (await searchParams).done === "1";
  const name = await storeName(token);
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pt-16 pb-16">
      <div className="paper flex flex-col items-start gap-4 p-6">
        {done ? (
          <>
            <h1 className="font-display text-[2.5rem] leading-[0.9] font-black [overflow-wrap:anywhere]">
              You&apos;re off {name ?? "this seller"}&apos;s list.
            </h1>
            <p>You&apos;ll still get receipts for things you buy.</p>
          </>
        ) : (
          <>
            <h1 className="font-display text-[2.5rem] leading-[0.9] font-black [overflow-wrap:anywhere]">
              Stop emails from {name ?? "this seller"}?
            </h1>
            <form action={unsubscribe}>
              <input type="hidden" name="token" value={token} />
              <TicketButton type="submit">Unsubscribe</TicketButton>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
