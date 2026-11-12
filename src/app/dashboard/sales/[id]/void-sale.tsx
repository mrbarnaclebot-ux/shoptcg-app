"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { lineButton } from "@/components/ticket-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";
import { voidSaleAction } from "../actions";

/** "Void sale", then a confirm step with the restock choice. */
export function VoidSale({
  saleId,
  receiptNo,
}: {
  saleId: string;
  receiptNo: string;
}) {
  const [asking, setAsking] = useState(false);
  const [restock, setRestock] = useState(true);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const kept = useRef(false);
  const run = () =>
    start(async () => {
      const ok = await voidSaleAction({
        saleId,
        restock,
        reason: reason || undefined,
      }).catch(() => false);
      if (!ok) toast.notSaved("The sale wasn't voided. Try again.");
      router.refresh();
    });
  if (!asking)
    return (
      <button
        type="button"
        ref={(el) => {
          if (el && kept.current) el.focus();
          kept.current = false;
        }}
        onClick={() => setAsking(true)}
        className="min-h-11 self-start text-sm text-muted-foreground underline underline-offset-4"
      >
        Void sale
      </button>
    );
  return (
    <div className="flex flex-col gap-3 border-t border-dashed border-border-strong pt-4">
      <p className="font-semibold">
        Void {receiptNo}? It comes out of your totals. This can&apos;t be
        undone.
      </p>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={restock}
          onChange={(e) => setRestock(e.target.checked)}
          className="mt-0.5 size-6 shrink-0 accent-[var(--sun)]"
        />
        <span className="font-semibold">Put the items back in stock</span>
      </label>
      <div className="flex flex-col gap-2">
        <Label htmlFor="void-reason">Reason (optional)</Label>
        <Input
          id="void-reason"
          maxLength={80}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Rang up the wrong card"
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          autoFocus
          onClick={() => {
            kept.current = true;
            setAsking(false);
          }}
          className={lineButton}
        >
          Keep sale
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={run}
          className={`${lineButton} text-danger`}
        >
          {pending ? "Voiding" : "Void sale"}
        </button>
      </div>
    </div>
  );
}
