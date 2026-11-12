import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ReceiptSummary } from "@/components/receipt-summary";
import { RequestLines } from "@/components/request-lines";
import { ShowMoment } from "@/components/show-moment";
import { Ticket } from "@/components/ticket";
import { lineButton } from "@/components/ticket-button";
import { receiptTime } from "@/lib/format";
import { getDb } from "@/db";
import { readBuyerSid } from "@/lib/buyer-session";
import { buyerRequest } from "@/lib/request-reads";
import { saleForRequest } from "@/lib/sales";
import { UUID } from "@/lib/storefront";
import { storeOr404 } from "../../store-lookup";
import {
  CancelRequest,
  HoldClock,
  HoldWarning,
  ReceiptNote,
  RequestLive,
  SendAgain,
} from "./request-live";

// Reads the buyer's cookie before any Suspense boundary so a stranger gets a real 404.
export const instant = false;

export const metadata: Metadata = {
  title: "Your request - shoptcg",
  robots: { index: false },
};

const COPY = {
  declined: {
    title: "The seller couldn't do this one.",
    sub: "Items are back in the store. You can talk to the seller at the table or send a new list.",
  },
  expired: {
    title: "Your hold ended.",
    sub: "We released the items so other buyers can see them. If they're still there, you can send again.",
  },
  cancelled: {
    title: "Request cancelled.",
    sub: "Your items are back in the store.",
  },
};

export default async function RequestPage({
  params,
}: PageProps<"/[slug]/request/[id]">) {
  const { slug, id } = await params;
  const store = await storeOr404(slug);
  const sid = await readBuyerSid();
  const r = sid && UUID.test(id) ? await buyerRequest(getDb(), id, sid) : null;
  if (!r || r.slug !== slug) notFound();
  if (r.status === "confirmed") return <Sold requestId={r.id} slug={slug} />;
  return (
    <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col gap-5 px-4 pt-6 pb-16 md:pt-10">
      <RequestLive id={r.id} slug={slug} status={r.status} lines={r.lines} />
      {r.status === "pending" ? (
        <>
          <Ticket
            as="div"
            stub={<HoldClock at={r.expiresAt.getTime()} table={r.tableLabel} />}
          >
            <h1 className="font-display text-[2.5rem] leading-[0.9] font-black text-balance [overflow-wrap:anywhere]">
              Sent to {store.name}
            </h1>
            <p className="mt-2 mb-4 text-muted-foreground">
              Head to the table and show this screen. Your items are held for
              you.
            </p>
            <p className="text-sm font-semibold">Show the seller this code</p>
            <p
              data-testid="request-code"
              className="font-display num text-[4.5rem] leading-none font-black"
            >
              {r.code}
            </p>
            <HoldWarning at={r.expiresAt.getTime()} table={r.tableLabel} />
            <RequestLines lines={r.lines} />
          </Ticket>
          <CancelRequest id={r.id} />
        </>
      ) : (
        <Ended
          {...COPY[r.status]}
          action={
            r.status === "expired" ? (
              <SendAgain slug={slug} lines={r.lines} />
            ) : (
              <Link href={`/${slug}`} className={lineButton}>
                Back to store
              </Link>
            )
          }
        />
      )}
    </main>
  );
}

async function Sold(props: { requestId: string; slug: string }) {
  const sale = await saleForRequest(getDb(), props.requestId);
  if (!sale) notFound();
  return (
    <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col gap-5 px-4 pt-6 pb-16 md:pt-10">
      <h1 className="sr-only">Your receipt</h1>
      <ShowMoment
        stamp="SOLD"
        headline="Sold. Enjoy your cards!"
        no={sale.receiptNo}
      >
        <p className="font-semibold [overflow-wrap:anywhere]">
          {sale.storeName}. {receiptTime(sale.createdAt, sale.timeZone)}.
          Receipt {sale.receiptNo}
        </p>
        <ReceiptSummary sale={sale} />
      </ShowMoment>
      {sale.buyerEmail && (
        <ReceiptNote status={sale.emailStatus} email={sale.buyerEmail} />
      )}
      <Link href={`/${props.slug}`} className={`${lineButton} self-start`}>
        Back to store
      </Link>
    </main>
  );
}

function Ended(props: { title: string; sub: string; action: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="font-display text-[3rem] leading-[0.9] font-black text-balance">
        {props.title}
      </h1>
      <p className="text-muted-foreground">{props.sub}</p>
      {props.action}
    </div>
  );
}
