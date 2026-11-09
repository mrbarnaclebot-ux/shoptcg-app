"use client";

import { useOptimistic, useState, useTransition } from "react";
import { lineButton, TicketButton } from "@/components/ticket-button";
import type { StoreState } from "@/lib/store-state";
import { toast } from "@/lib/toast";
import { setStateAction } from "./actions";

type Choice =
  | { state: "open" }
  | { state: "off" }
  | { state: "paused"; minutes: 15 | 60 | null };

const PAUSES = [
  { minutes: 15, label: "15 min" },
  { minutes: 60, label: "1 hour" },
  { minutes: null, label: "Until I reopen" },
] as const;

const COPY: Record<StoreState, { title: string; sub: string }> = {
  open: { title: "Open", sub: "Buyers can send requests." },
  paused: { title: "Paused", sub: "Buyers can browse, not send." },
  off: { title: "Not vending", sub: "Your page shows no stock or prices." },
};

/**
 * Open at the table every show, so it is the biggest control on the dashboard:
 * paper when open, a cut line otherwise. Opening is always one tap; pausing and
 * stopping say first who is still waiting. New stores start paused.
 */
export function StoreControl(props: {
  live: StoreState;
  resumesInMin: number | null;
  autoPaused: boolean;
  waiting: number;
}) {
  const [shown, setShown] = useOptimistic(props.live);
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState<"pause" | "off" | null>(null);
  const choose = (next: Choice) =>
    start(async () => {
      setAsking(null);
      setShown(next.state);
      const res = await setStateAction(next).catch(() => ({
        error: "Couldn't reach the server. Your store didn't change.",
      }));
      // On error the optimistic value falls back to the saved one by itself.
      if (res.error) toast.notSaved(res.error);
      else
        toast.storeState(next.state, "minutes" in next ? next.minutes : null);
    });
  const open = shown === "open";
  let sub = COPY[shown].sub;
  if (shown === "paused" && !pending) {
    if (props.resumesInMin !== null)
      sub = `Opens again in ${props.resumesInMin} min.`;
    else if (props.autoPaused) sub = "Paused itself 14 hours after you opened.";
  }
  const warn =
    props.waiting > 0 &&
    `${props.waiting} ${props.waiting === 1 ? "buyer is" : "buyers are"} waiting. Their holds stay until you confirm or decline.`;
  return (
    <section
      aria-label="Your store"
      data-state={shown}
      aria-busy={pending}
      className={`flex flex-col gap-4 px-5 py-4 ${
        open
          ? "paper bg-surface text-text"
          : "shadow-[inset_0_0_0_1.5px_var(--border-strong)]"
      }`}
    >
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-4">
        <span
          aria-hidden
          className={`size-3 rounded-full ${open ? "bg-success" : "bg-subtle"}`}
        />
        <h2 className="font-display text-[2rem] leading-none font-black">
          {COPY[shown].title}
        </h2>
        <p role="status" className="col-start-2 text-sm text-muted-foreground">
          {sub}
        </p>
      </div>
      {!open && (
        <TicketButton
          onClick={() => choose({ state: "open" })}
          className="w-full"
        >
          Open store
        </TicketButton>
      )}
      {asking ? (
        <div className="flex flex-col gap-3 border-t border-dashed border-border pt-3">
          {warn && <p className="text-sm font-semibold">{warn}</p>}
          {asking === "pause" ? (
            <div
              role="group"
              aria-label="Pause for"
              className="flex flex-wrap gap-2"
            >
              {PAUSES.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() =>
                    choose({ state: "paused", minutes: p.minutes })
                  }
                  className={lineButton}
                >
                  {p.label}
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => choose({ state: "off" })}
              className={`${lineButton} self-start`}
            >
              Stop vending
            </button>
          )}
          <button
            type="button"
            autoFocus
            onClick={() => setAsking(null)}
            className="min-h-11 self-start text-sm text-muted-foreground underline underline-offset-4"
          >
            Keep it {COPY[shown].title.toLowerCase()}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-x-6">
          {shown !== "paused" && (
            <button
              type="button"
              onClick={() => setAsking("pause")}
              className="min-h-11 text-sm font-semibold underline decoration-brand decoration-[1.5px] underline-offset-[5px]"
            >
              Pause
            </button>
          )}
          {shown !== "off" && (
            <button
              type="button"
              onClick={() => setAsking("off")}
              className="min-h-11 text-sm font-semibold underline decoration-brand decoration-[1.5px] underline-offset-[5px]"
            >
              Not vending
            </button>
          )}
        </div>
      )}
    </section>
  );
}
