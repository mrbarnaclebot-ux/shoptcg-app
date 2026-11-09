"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { lineButton } from "@/components/ticket-button";
import { toast } from "@/lib/toast";
import { removeCustomerAction } from "./actions";

export function RemoveCustomer({ id, name }: { id: string; name: string }) {
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const remove = () =>
    start(async () => {
      const done = await removeCustomerAction(id).catch(() => false);
      if (!done)
        toast.notSaved("That customer is already gone, or we're offline.");
      setAsking(false);
      router.refresh();
    });
  if (!asking)
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        aria-label={`Remove ${name}`}
        className="min-h-11 self-start font-semibold text-danger underline underline-offset-4"
      >
        Remove customer
      </button>
    );
  return (
    <div className="flex flex-col gap-2">
      <p className="font-semibold">
        Remove {name}? Their receipts stay, as sales records.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={remove}
          className={lineButton}
        >
          Remove
        </button>
        <button
          type="button"
          onClick={() => setAsking(false)}
          className={lineButton}
        >
          Keep
        </button>
      </div>
    </div>
  );
}
