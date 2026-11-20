"use client";

import {
  createContext,
  useContext,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { lineButton } from "@/components/ticket-button";
import { toast } from "@/lib/toast";
import { showAction } from "./actions";
import { HeldAsk, restore, useRemove } from "./edit-panel";

const Picked = createContext<{
  on: (id: string) => boolean;
  flip: (id: string) => void;
} | null>(null);

/** A row's tick box, 44px to tap. */
export function Pick({ id, name }: { id: string; name: string }) {
  const ctx = useContext(Picked);
  if (!ctx) return null;
  return (
    <label className="grid size-11 shrink-0 cursor-pointer place-items-center">
      <input
        type="checkbox"
        checked={ctx.on(id)}
        onChange={() => ctx.flip(id)}
        aria-label={`Select ${name}`}
        className="size-5 accent-brand"
      />
    </label>
  );
}

type View = "active" | "hidden" | "removed";

/**
 * The list with tick boxes and, once one is ticked, a bar of actions for all
 * of them. Only rows still shown count, so a row a refresh moved off this view
 * drops out of the selection.
 */
export function Bulk(props: {
  rows: { id: string; name: string }[];
  view: View;
  children: ReactNode;
}) {
  const { rows } = props;
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const chosen = rows.filter((r) => picked.has(r.id));
  const all = rows.length > 0 && chosen.length === rows.length;
  const flip = (id: string) =>
    setPicked((had) => {
      const next = new Set(had);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  return (
    <Picked.Provider value={{ on: (id) => picked.has(id), flip }}>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 self-start pr-2 font-semibold">
        <input
          type="checkbox"
          checked={all}
          ref={(el) => {
            if (el) el.indeterminate = chosen.length > 0 && !all;
          }}
          onChange={() =>
            setPicked(all ? new Set() : new Set(rows.map((r) => r.id)))
          }
          className="ml-3 size-5 accent-brand"
        />
        Select all shown
      </label>
      {props.children}
      {chosen.length > 0 && (
        <Bar
          key={chosen.map((r) => r.id).join()}
          rows={chosen}
          view={props.view}
          onDone={() => setPicked(new Set())}
        />
      )}
    </Picked.Provider>
  );
}

function Bar(props: {
  rows: { id: string; name: string }[];
  view: View;
  onDone: () => void;
}) {
  const { rows, view, onDone } = props;
  const ids = rows.map((r) => r.id);
  const n = rows.length;
  const what = n === 1 ? rows[0].name : `${n} items`;
  const gone = useRemove(ids, what, onDone);
  const [saving, start] = useTransition();
  const pending = saving || gone.pending;
  const show = (active: boolean) =>
    start(async () => {
      const res = await showAction(ids, active).catch(() => ({
        error: "Couldn't save that. Try again.",
      }));
      if (res.error) return void toast.notSaved(res.error);
      toast.itemUpdated(
        what,
        active ? "Back on your public table." : "Off your public table.",
      );
      onDone();
    });
  const again = () =>
    start(async () => {
      if (await restore(ids, what)) onDone();
    });
  return (
    // Above the phone tab bar; toasts keep clear of it (data-toast-clear).
    <div
      data-toast-clear
      role="region"
      aria-label="Selected items"
      className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 -mx-4 flex flex-col gap-3 border-t border-border bg-bg px-4 py-3 md:mx-0 lg:bottom-0"
    >
      <div className="flex flex-wrap items-center gap-3">
        <p className="num mr-auto font-semibold">{n} selected</p>
        {view === "removed" ? (
          <button
            type="button"
            disabled={pending}
            onClick={again}
            className={lineButton}
          >
            Restore
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => show(view === "hidden")}
              className={lineButton}
            >
              {view === "hidden" ? "Show in store" : "Hide from store"}
            </button>
            <button
              type="button"
              disabled={pending || gone.held > 0}
              onClick={() => gone.remove(false)}
              className={`${lineButton} text-danger`}
            >
              Remove
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onDone}
          className="inline-flex min-h-11 items-center px-2 font-semibold underline decoration-brand decoration-[1.5px] underline-offset-[5px]"
        >
          Clear
        </button>
      </div>
      {gone.error && <p className="text-sm text-danger">{gone.error}</p>}
      {gone.held > 0 && (
        <HeldAsk
          held={gone.held}
          many={n > 1}
          pending={pending}
          onKeep={gone.keep}
          onRemove={() => gone.remove(true)}
        />
      )}
    </div>
  );
}
