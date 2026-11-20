"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { lineButton } from "@/components/ticket-button";
import { toast } from "@/lib/toast";
import { removeCustomerAction } from "./actions";

export function RemoveCustomer({ id, name }: { id: string; name: string }) {
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  // The link came back because of Keep, so focus goes with it.
  const kept = useRef(false);
  const remove = () =>
    start(async () => {
      const done = await removeCustomerAction(id).catch(() => false);
      if (done) toast.customerRemoved(name);
      else toast.notSaved("That customer is already gone, or we're offline.");
      setAsking(false);
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
        // Starts with the visible words, so voice control finds it (WCAG 2.5.3).
        aria-label={`Remove customer ${name}`}
        className="min-h-11 self-start text-sm text-muted-foreground underline underline-offset-4"
      >
        Remove customer
      </button>
    );
  return (
    <div className="mt-2 flex flex-col gap-2">
      <p className="font-semibold">
        Remove {name} for good? Receipts stay. Anyone on a list you already
        exported stays on it.
      </p>
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
          Keep
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={remove}
          className={`${lineButton} text-danger`}
        >
          Remove
        </button>
      </div>
    </div>
  );
}
