import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ReceiptSummary } from "@/components/receipt-summary";
import { StubValue, Ticket } from "@/components/ticket";
import { lineButton } from "@/components/ticket-button";
import { getDb } from "@/db";
import { appUrl } from "@/lib/deployed";
import { saleWithLines } from "@/lib/sales";
import { requireStore } from "@/lib/session";
import { UUID } from "@/lib/storefront";
import { CopyLink } from "../../copy-link";
import { ReceiptEmailStatus } from "./receipt-email-status";

export const metadata: Metadata = { title: "Receipt - shoptcg" };

export default function ReceiptPage({
  params,
}: PageProps<"/dashboard/sales/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 pt-6 pb-16">
      <Suspense
        fallback={<div className="h-[480px] animate-pulse bg-surface" />}
      >
        <Receipt params={params} />
      </Suspense>
    </main>
  );
}

async function Receipt({
  params,
}: Pick<PageProps<"/dashboard/sales/[id]">, "params">) {
  const { id } = await params;
  const { store } = await requireStore();
  // ponytail: streamed inside a private page, so a miss is a 200 with noindex and this copy; no data leaks. Check in Proxy if a real status matters.
  const sale = UUID.test(id)
    ? await saleWithLines(getDb(), store.id, id)
    : null;
  if (!sale) notFound();
  const when = sale.createdAt.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
  return (
    <>
      <Ticket
        as="div"
        bodyClassName="flex flex-col gap-3"
        stub={
          <StubValue
            k="Receipt"
            v={
              <span className="text-[1.5rem] whitespace-nowrap">
                {sale.receiptNo}
              </span>
            }
            testId="receipt-no"
          />
        }
      >
        <h1 className="font-display text-[2.5rem] leading-[0.9] font-black [overflow-wrap:anywhere]">
          {store.name}
        </h1>
        <p className="text-muted-foreground">
          {sale.buyerName}. {when} UTC
        </p>
        <ReceiptSummary sale={sale} />
      </Ticket>
      <ReceiptEmailStatus
        saleId={sale.id}
        status={sale.emailStatus}
        email={sale.buyerEmail}
      />
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">
          Buyer&apos;s receipt page
        </span>
        <CopyLink
          url={new URL(
            `/${sale.slug}/request/${sale.requestId}`,
            appUrl(),
          ).toString()}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        Receipts can&apos;t be changed once saved.
      </p>
      <Link href="/dashboard/sales" className={`${lineButton} self-start`}>
        All sales
      </Link>
    </>
  );
}
