"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useSyncExternalStore } from "react";
import { usd } from "@/lib/format";
import {
  dropPending,
  pendingSnapshot,
  sendPending,
  subscribePending,
  type PendingSale,
} from "@/lib/pending-sales";
import { toast } from "@/lib/toast";
import { confirmSaleAction } from "./requests/[id]/actions";
import { useStoreLive } from "./store-live";

export function usePendingSales(): PendingSale[] {
  const raw = useSyncExternalStore(
    subscribePending,
    pendingSnapshot,
    () => "[]",
  );
  return JSON.parse(raw);
}

function useSendPending() {
  const router = useRouter();
  return () =>
    sendPending(confirmSaleAction, {
      sent: (p, res) => {
        toast.saleRecorded(
          undefined,
          {
            receiptNo: res.receiptNo,
            total: usd(Number(res.total)),
            emailed: p.emailed,
          },
          () => router.push(`/dashboard/sales/${res.saleId}`),
        );
        router.refresh();
      },
      refused: (p, why) =>
        toast.saleRefused(p.buyer, why, () =>
          router.push(`/dashboard/requests/${p.input.requestId}`),
        ),
    });
}

/**
 * Sends sales saved on this phone: on load, when the browser says it's back
 * online, and when the store stream reconnects (WiFi that lied about it).
 */
export function PendingSync() {
  const send = useEffectEvent(useSendPending());
  const { up } = useStoreLive();
  useEffect(() => {
    if (up) send();
  }, [up]);
  useEffect(() => {
    const online = () => send();
    addEventListener("online", online);
    return () => removeEventListener("online", online);
  }, []);
  return null;
}

const link =
  "min-h-11 font-semibold underline decoration-brand decoration-[1.5px] underline-offset-[5px]";

/** Under the queue's Live line: what is waiting on this phone, and what was refused. */
export function PendingNote() {
  const list = usePendingSales();
  const send = useSendPending();
  const waiting = list.filter((p) => !p.refused).length;
  if (!list.length) return null;
  return (
    <div className="flex flex-col gap-1 text-sm">
      {waiting > 0 && (
        <p className="flex flex-wrap items-center gap-x-3">
          <span role="status" className="font-semibold">
            {waiting} {waiting === 1 ? "sale" : "sales"} waiting to sync
          </span>
          <button type="button" onClick={send} className={link}>
            Send now
          </button>
        </p>
      )}
      {list
        .filter((p) => p.refused)
        .map((p) => (
          <div
            key={p.input.requestId}
            role="alert"
            className="flex flex-col gap-1 border-t border-border pt-2"
          >
            <p>
              <b>Sale for {p.buyer} not recorded.</b> {p.refused}
            </p>
            <p className="flex flex-wrap gap-x-4">
              <Link
                href={`/dashboard/requests/${p.input.requestId}`}
                className={`${link} inline-flex items-center`}
              >
                Open request
              </Link>
              <button
                type="button"
                onClick={() => dropPending(p.input.requestId)}
                className={`${link} text-muted-foreground`}
              >
                Discard
              </button>
            </p>
          </div>
        ))}
    </div>
  );
}
