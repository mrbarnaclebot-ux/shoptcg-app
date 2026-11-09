"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { TicketButton } from "@/components/ticket-button";
import { toast } from "@/lib/toast";
import { useRefreshWhile } from "@/lib/use-live";
import { resendReceipt } from "../actions";

/** The email goes out after the sale saves, so this re-reads until it has landed. */
export function ReceiptEmailStatus(props: {
  saleId: string;
  status: "pending" | "sent" | "failed" | null;
  email: string;
  attemptsLeft: number;
}) {
  const { saleId, status, email, attemptsLeft } = props;
  const router = useRouter();
  const [pending, start] = useTransition();
  const gaveUp = useRefreshWhile(status === "pending");
  // This page shows the number now, so the toast stops covering it.
  useEffect(() => toast.receiptOpened(), []);
  const resend = () =>
    start(async () => {
      const ok = await resendReceipt(saleId).catch(() => false);
      if (ok) toast.receiptSent(email);
      else toast.receiptFailed(attemptsLeft > 1 ? resend : undefined);
      router.refresh();
    });
  return (
    <div className="flex flex-col items-start gap-3">
      <p role="status" className="[overflow-wrap:anywhere]">
        {status === "sent" && `Emailed to ${email}.`}
        {status === "pending" &&
          (gaveUp ? "This may not have sent." : `Sending to ${email}.`)}
        {status === "failed" && "Email didn't send."}
      </p>
      {attemptsLeft > 0 && (
        <TicketButton variant="secondary" disabled={pending} onClick={resend}>
          {pending ? "Sending" : "Resend"}
        </TicketButton>
      )}
    </div>
  );
}
