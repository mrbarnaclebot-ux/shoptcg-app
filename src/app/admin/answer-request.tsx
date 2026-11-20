"use client";

import { useState, useTransition } from "react";
import { lineButton } from "@/components/ticket-button";
import { answerRequestAction } from "./actions";

export function AnswerRequest({ id, name }: { id: string; name: string }) {
  const [note, setNote] = useState<string | null>(null);
  // Dismiss emails a no and can't be taken back, so it asks first.
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  const answer = (invite: boolean) =>
    start(async () => {
      const done = await answerRequestAction(id, invite).catch(() => false);
      if (!done) setNote("Couldn't do that. It may already be answered.");
      setAsking(false);
    });
  return (
    <div className="flex flex-col gap-2">
      {asking ? (
        <div role="group" className="flex flex-col gap-2">
          <p className="font-semibold">
            Dismiss {name}? They get an email saying no.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              autoFocus
              onClick={() => setAsking(false)}
              className={lineButton}
            >
              Keep
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => answer(false)}
              className={`${lineButton} text-danger`}
            >
              Yes, dismiss
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => answer(true)}
            aria-label={`Invite ${name}`}
            className={lineButton}
          >
            Invite
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setAsking(true)}
            aria-label={`Dismiss ${name}`}
            className={`${lineButton} text-danger`}
          >
            Dismiss
          </button>
        </div>
      )}
      {note && (
        <p role="status" className="text-sm text-danger">
          {note}
        </p>
      )}
    </div>
  );
}
