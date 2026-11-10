"use client";

import { useState, useTransition } from "react";
import { lineButton } from "@/components/ticket-button";
import { removeStoreImagesAction, suspendStoreAction } from "./actions";

const link =
  "min-h-11 text-sm underline underline-offset-4 disabled:opacity-45";

/** Stop or allow a vendor's store, and take down its images. Each asks first. */
export function VendorControls(props: {
  storeId: string;
  name: string;
  suspended: boolean;
  hasImages: boolean;
}) {
  const [asking, setAsking] = useState<"stop" | "images" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (action: () => Promise<boolean>) =>
    start(async () => {
      const done = await action().catch(() => false);
      setAsking(null);
      setNote(done ? null : "That didn't save. Try again.");
    });
  const stop = (on: boolean) =>
    run(() => suspendStoreAction(props.storeId, on));
  if (asking)
    return (
      <div className="flex flex-col gap-2">
        <p className="font-semibold">
          {asking === "stop"
            ? `Stop ${props.name}? Its page shows no stock and the vendor can't reopen it.`
            : `Remove the banner and profile image from ${props.name}?`}
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            autoFocus
            onClick={() => setAsking(null)}
            className={lineButton}
          >
            Keep
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              asking === "stop"
                ? stop(true)
                : run(() => removeStoreImagesAction(props.storeId))
            }
            className={`${lineButton} text-danger`}
          >
            {asking === "stop" ? "Stop store" : "Remove images"}
          </button>
        </div>
      </div>
    );
  return (
    <div className="flex flex-wrap items-center gap-x-5">
      {props.suspended ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => stop(false)}
          className={link}
        >
          Allow store
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setAsking("stop")}
          className={link}
        >
          Stop store
        </button>
      )}
      {props.hasImages && (
        <button
          type="button"
          onClick={() => setAsking("images")}
          className={link}
        >
          Remove images
        </button>
      )}
      {note && (
        <p role="status" className="basis-full text-sm text-danger">
          {note}
        </p>
      )}
    </div>
  );
}
