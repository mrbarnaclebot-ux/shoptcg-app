"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { TicketButton } from "@/components/ticket-button";
import { toast } from "@/lib/toast";
import { resendReceipt } from "../actions";

const POLL_MS = 2000;
const MAX_POLLS = 10;

/** The email goes out after the sale saves, so this re-reads until it has landed. */
export function ReceiptEmailStatus(props: {
  saleId: string;
  status: "pending" | "sent" | "failed" | null;
  email: string;
}) {
  const { saleId, status, email } = props;
  const router = useRouter();
  const [pending, start] = useTransition();
  useEffect(() => {
    if (status !== "pending") return;
    let n = 0;
    const t = setInterval(() => {
      if (++n > MAX_POLLS) clearInterval(t);
      else router.refresh();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [status, router]);
  const resend = () =>
    start(async () => {
      const ok = await resendReceipt(saleId).catch(() => false);
      if (ok) toast.receiptSent(email);
      else toast.receiptFailed(resend);
      router.refresh();
    });
  return (
    <div className="flex flex-col items-start gap-3">
      <p role="status" className="[overflow-wrap:anywhere]">
        {status === "sent" && `Emailed to ${email}.`}
        {status === "pending" && `Sending to ${email}.`}
        {status === "failed" && "Email didn't send."}
      </p>
      <TicketButton variant="secondary" disabled={pending} onClick={resend}>
        {pending ? "Sending" : "Resend"}
      </TicketButton>
    </div>
  );
}
