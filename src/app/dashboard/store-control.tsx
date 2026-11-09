"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "@/lib/toast";
import { setOpenAction } from "./actions";

// Flipped at the table every show, so it is the biggest control on the
// dashboard: paper when open (you're holding the table), a cut line when closed.
// New stores start closed, so nobody pings the vendor before doors open.
export function OpenSwitch({ open }: { open: boolean }) {
  const [shown, setShown] = useOptimistic(open);
  const [pending, start] = useTransition();
  const flip = () =>
    start(async () => {
      const next = !shown;
      setShown(next);
      const res = await setOpenAction(next).catch(() => ({
        error: "Couldn't reach the server. Your store didn't change.",
      }));
      // On error the optimistic value falls back to the saved one by itself.
      if (res.error) toast.notSaved(res.error);
      else toast.storeOpen(next);
    });
  return (
    <button
      type="button"
      role="switch"
      aria-label="Store open"
      aria-checked={shown}
      aria-busy={pending}
      onClick={flip}
      className={`grid min-h-16 w-full grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-3 text-left transition-colors ${
        shown
          ? "paper bg-surface text-text"
          : "shadow-[inset_0_0_0_1.5px_var(--border-strong)] hover:bg-surface"
      }`}
    >
      <span
        aria-hidden
        className={`size-3 rounded-full ${shown ? "bg-success" : "bg-subtle"}`}
      />
      <span className="flex flex-col">
        <span className="font-display text-[2rem] leading-none font-black">
          {shown ? "Open" : "Closed"}
        </span>
        <span className="text-sm text-muted-foreground">
          {shown
            ? "Buyers can send requests."
            : "Buyers can browse. Open when doors open."}
        </span>
      </span>
      <span className="text-sm font-semibold underline decoration-brand decoration-[1.5px] underline-offset-[5px]">
        {shown ? "Close" : "Open"}
      </span>
    </button>
  );
}
