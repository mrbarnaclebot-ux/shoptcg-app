import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ReceiptSummary } from "@/components/receipt-summary";
import { Stamp } from "@/components/stamp";
import { StubValue, Ticket, TicketLoading } from "@/components/ticket";
import { lineButton } from "@/components/ticket-button";
import { getDb } from "@/db";
import { receiptTime } from "@/lib/format";
import { MAX_ATTEMPTS } from "@/lib/receipts";
import { saleWithLines } from "@/lib/sales";
import { requireStore } from "@/lib/session";
import { UUID } from "@/lib/storefront";
import { ReceiptEmailStatus } from "./receipt-email-status";

export const metadata: Metadata = { title: "Receipt - shoptcg" };

export default function ReceiptPage({
  params,
}: PageProps<"/dashboard/sales/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 pt-6 pb-16">
      <Suspense fallback={<TicketLoading>Loading receipt</TicketLoading>}>
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
        <Stamp className="self-start">Paid</Stamp>
        <h1 className="font-display text-[2.5rem] leading-[0.9] font-black [overflow-wrap:anywhere]">
          {sale.storeName}
        </h1>
        <p className="text-muted-foreground">
          {sale.buyerName}. {receiptTime(sale.createdAt, sale.timeZone)}
        </p>
        <ReceiptSummary sale={sale} />
      </Ticket>
      <ReceiptEmailStatus
        saleId={sale.id}
        status={sale.emailStatus}
        email={sale.buyerEmail}
        attemptsLeft={MAX_ATTEMPTS - (sale.emailAttempts ?? 0)}
      />
      <p className="text-sm text-muted-foreground">
        Receipts can&apos;t be changed once saved.
      </p>
      <Link href="/dashboard/sales" className={`${lineButton} self-start`}>
        All sales
      </Link>
    </>
  );
}
