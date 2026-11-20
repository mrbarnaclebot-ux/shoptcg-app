import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { metaLine } from "@/app/[slug]/tile";
import { TicketLoading } from "@/components/ticket";
import { lineButton } from "@/components/ticket-button";
import { getDb } from "@/db";
import { withLanguage } from "@/lib/format";
import { linesFor } from "@/lib/request-reads";
import { saleDraft } from "@/lib/sales";
import { requireStore } from "@/lib/session";
import { UUID } from "@/lib/storefront";
import { SaleForm } from "./sale-form";

export const metadata: Metadata = { title: "Review sale" };

export default function ReviewSalePage({
  params,
}: PageProps<"/dashboard/requests/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 pt-6 pb-16">
      <Suspense fallback={<TicketLoading>Loading request</TicketLoading>}>
        <Review params={params} />
      </Suspense>
    </main>
  );
}

async function Review({
  params,
}: Pick<PageProps<"/dashboard/requests/[id]">, "params">) {
  const { id } = await params;
  const { store } = await requireStore();
  if (!UUID.test(id)) notFound();
  const db = getDb();
  const draft = await saleDraft(db, store.id, id);
  if (!draft) notFound();
  if (draft.saleId) redirect(`/dashboard/sales/${draft.saleId}`);
  if (draft.status !== "pending" && draft.status !== "expired")
    return (
      <div className="flex flex-col items-start gap-4">
        <h1 className="font-display text-[3rem] leading-[0.9] font-black">
          This request was closed.
        </h1>
        <Link href="/dashboard" className={lineButton}>
          Back to requests
        </Link>
      </div>
    );
  const lines = (await linesFor(db, [id])).get(id) ?? [];
  return (
    <SaleForm
      request={{
        id,
        code: draft.code,
        buyerName: draft.buyerName ?? "Buyer",
        isTest: draft.isTest,
        emailed: draft.emailed,
        expiresAt: draft.expiresAt.getTime(),
        fulfil: draft.fulfil,
        payWith: draft.payWith,
        phone: draft.buyerPhone,
        address: draft.deliveryAddress,
      }}
      lines={lines.map((l) => ({
        listingId: l.listingId,
        name: l.name,
        meta: withLanguage(metaLine(l), l.language),
        number: l.number,
        kind: l.kind,
        imageUrl: l.imageUrl,
        qty: l.qty,
        price: l.price.toFixed(2),
        left: draft.left.get(l.listingId)?.left ?? 0,
        held: draft.left.get(l.listingId)?.held ?? false,
      }))}
      currency={store.secondCurrency}
      fxRate={store.fxRate === null ? null : Number(store.fxRate)}
    />
  );
}
