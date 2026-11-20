"use client";

import { useState, useTransition } from "react";
import { lineButton } from "@/components/ticket-button";
import { blockAction, endEventAction, releaseAction } from "../actions";

/**
 * An action that asks once before it runs. `danger` ones (End, Block) look
 * like the app's other removals: red, with Keep first and focused.
 */
function Confirmed(props: {
  label: string;
  ask: string;
  run: () => Promise<boolean>;
  failed: string;
  danger?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // The question closes on a failure, so the error shows either way.
  const alert = error && (
    <p role="alert" className="w-full text-sm font-semibold text-danger">
      {error}
    </p>
  );
  if (!asking)
    return (
      <>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setAsking(true);
          }}
          className={`min-h-11 text-sm font-semibold underline decoration-[1.5px] underline-offset-[5px] ${props.danger ? "text-danger" : "decoration-brand"}`}
        >
          {props.label}
        </button>
        {alert}
      </>
    );
  return (
    <div className="flex flex-wrap items-center gap-2" role="group">
      <span className="text-sm font-semibold">{props.ask}</span>
      <button
        type="button"
        autoFocus={props.danger}
        onClick={() => setAsking(false)}
        className={`${lineButton} min-h-11 px-3 text-sm`}
      >
        Keep
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const ok = await props.run().catch(() => false);
            if (!ok) setError(props.failed);
            setAsking(false);
          })
        }
        className={`${lineButton} min-h-11 px-3 text-sm ${props.danger ? "text-danger" : ""}`}
      >
        {pending ? "Working" : `Yes, ${props.label.toLowerCase()}`}
      </button>
    </div>
  );
}

export function EndEvent({ id }: { id: string }) {
  return (
    <Confirmed
      label="End now"
      ask="End the event for everyone?"
      run={() => endEventAction(id)}
      failed="It has already ended."
      danger
    />
  );
}

export function BuyerActions({ requestId }: { requestId: string }) {
  return (
    <div className="flex flex-wrap gap-x-5">
      <Confirmed
        label="Release"
        ask="Give their claims back?"
        run={() => releaseAction(requestId)}
        failed="Already released or paid."
      />
      <Confirmed
        label="Block"
        ask="Release and block this number and email?"
        run={() => blockAction(requestId)}
        failed="Already released or paid."
        danger
      />
    </div>
  );
}
