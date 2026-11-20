import { Inbox } from "lucide-react";
import Link from "next/link";
import { SectionMark } from "@/components/section-mark";
import { lineButton } from "@/components/ticket-button";
import { getDb } from "@/db";
import { vapid } from "@/lib/push";
import { usd } from "@/lib/format";
import { storeQueue, type QueueTicket as Row } from "@/lib/request-reads";
import { salesOn } from "@/lib/sales";
import { modeCopy, type SellingMode } from "@/lib/selling-mode";
import { sellerTimeZone } from "@/lib/session";
import { AlertsRow, InstallNudge } from "./alerts";
import { QueueLive, QueueTicket, SendTestRequest } from "./queue-live";

// Only what the ticket draws crosses to the client: the email stays on the server.
const view = (t: Row) => ({
  id: t.id,
  code: t.code,
  buyerName: t.buyerName,
  isTest: t.isTest,
  createdAt: t.createdAt.getTime(),
  expiresAt: t.expiresAt.getTime(),
  lines: t.lines,
});

export async function RequestQueue({
  storeId,
  mode,
}: {
  storeId: string;
  mode: SellingMode;
}) {
  const tz = await sellerTimeZone();
  const queue = await storeQueue(getDb(), storeId, tz).catch((err) => {
    console.error("[queue] load failed", err);
    return null;
  });
  const sold = (await salesOn(getDb(), storeId, tz).catch(() => [])).filter(
    (s) => !s.voided,
  );
  const takings = sold.reduce((sum, s) => sum + Number(s.total), 0);
  return (
    <section aria-labelledby="requests-h" className="flex flex-col gap-4">
      <SectionMark n={1} id="requests-h" icon={Inbox}>
        Requests
      </SectionMark>
      <AlertsRow publicKey={vapid()?.publicKey ?? null} />
      {queue ? (
        <>
          {/* The vendor's own table sale is in the list but never chimes. */}
          <QueueLive pending={queue.pending.filter((t) => !t.walkUp).length} />
          {queue.pending.length ? (
            <ul className="flex flex-col gap-5">
              {queue.pending.map((t) => (
                <QueueTicket key={t.id} t={view(t)} />
              ))}
            </ul>
          ) : (
            <Empty mode={mode} />
          )}
          {queue.expired.length > 0 && (
            <details className="border-t border-border pt-3">
              <summary className="min-h-11 cursor-pointer font-semibold">
                Expired today ({queue.expired.length})
              </summary>
              <p className="mb-2 text-muted-foreground">
                Hold ended. Items are back in stock.
              </p>
              <ul className="text-sm">
                {queue.expired.map((t) => (
                  <li key={t.id} className="border-t border-border">
                    <Link
                      href={`/dashboard/requests/${t.id}`}
                      className="flex min-h-11 items-center justify-between py-2 hover:bg-surface"
                    >
                      {t.buyerName ?? "Buyer"}
                      <span className="num text-muted-foreground">
                        {t.code}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {sold.length > 0 && (
            <Link
              href="/dashboard/sales"
              className="num min-h-11 self-start py-2 font-semibold underline decoration-brand decoration-[1.5px] underline-offset-[5px]"
            >
              Today: {sold.length} {sold.length === 1 ? "sale" : "sales"},{" "}
              {usd(takings)}
            </Link>
          )}
        </>
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p>Couldn&apos;t load requests.</p>
          <Link href="/dashboard" className={lineButton}>
            Try again
          </Link>
        </div>
      )}
      {/* Below the tickets, so a request is never pushed down (UI-SPEC 10). */}
      <InstallNudge />
    </section>
  );
}

function Empty({ mode }: { mode: SellingMode }) {
  return (
    <div className="flex flex-col items-start gap-3 border-t border-dashed border-border-strong pt-5">
      <p className="font-display text-[2rem] leading-none font-extrabold">
        No requests yet.
      </p>
      <p className="max-w-[44ch] text-muted-foreground">
        {modeCopy(mode).queueEmpty}
      </p>
      <div className="mt-1 flex flex-wrap gap-3">
        <Link href="/dashboard/inventory" className={lineButton}>
          Go to inventory
        </Link>
        {modeCopy(mode).showTable && (
          <Link href="/dashboard/sign" className={lineButton}>
            Print table sign
          </Link>
        )}
        <SendTestRequest />
      </div>
    </div>
  );
}
