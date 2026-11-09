"use client";

import { useRef, useState, useTransition } from "react";
import { lineButton } from "@/components/ticket-button";
import { revokeInviteAction } from "./actions";

export function RevokeInvite({ id }: { id: string }) {
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // The link came back because of Keep, so focus goes with it.
  const kept = useRef(false);
  const revoke = () =>
    start(async () => {
      const done = await revokeInviteAction(id).catch(() => false);
      setAsking(false);
      if (!done) setNote("Couldn't revoke it. It may already be used.");
    });
  if (!asking)
    return (
      <div className="flex flex-col items-start">
        <button
          type="button"
          ref={(el) => {
            if (el && kept.current) el.focus();
            kept.current = false;
          }}
          onClick={() => setAsking(true)}
          className="min-h-11 text-sm underline underline-offset-4"
        >
          Revoke
        </button>
        {note && (
          <p role="status" className="text-sm text-danger">
            {note}
          </p>
        )}
      </div>
    );
  return (
    <div className="flex flex-col gap-2">
      <p className="font-semibold">
        Revoke this invite? Its code and any link already sent stop working.
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
          onClick={revoke}
          className={`${lineButton} text-danger`}
        >
          {pending ? "Revoking" : "Revoke invite"}
        </button>
      </div>
    </div>
  );
}
