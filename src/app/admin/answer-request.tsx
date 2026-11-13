"use client";

import { useState, useTransition } from "react";
import { lineButton } from "@/components/ticket-button";
import { answerRequestAction } from "./actions";

export function AnswerRequest({ id, name }: { id: string; name: string }) {
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const answer = (invite: boolean) =>
    start(async () => {
      const done = await answerRequestAction(id, invite).catch(() => false);
      if (!done) setNote("Couldn't do that. It may already be answered.");
    });
  return (
    <div className="flex flex-col gap-2">
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
          onClick={() => answer(false)}
          aria-label={`Dismiss ${name}`}
          className={lineButton}
        >
          Dismiss
        </button>
      </div>
      {note && (
        <p role="status" className="text-sm text-danger">
          {note}
        </p>
      )}
    </div>
  );
}
