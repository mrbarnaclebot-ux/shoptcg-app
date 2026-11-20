"use client";

import { useState, useTransition } from "react";
import { Ticket } from "@/components/ticket";
import { lineButton, TicketButton } from "@/components/ticket-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CONDITIONS } from "@/lib/condition";
import type { StockRow } from "@/lib/listings";
import { toast } from "@/lib/toast";
import { PhotoField } from "./add/custom-form";
import {
  removeAction,
  restoreAction,
  setPhotoAction,
  updateListingAction,
} from "./actions";

const FAILED = "Couldn't save that. Try again.";

/**
 * Restores removed items: the removal toast's Undo, the Removed view's button
 * and the bulk bar. `what` names them: an item's name or "3 items".
 */
export async function restore(ids: string[], what: string) {
  const res = await restoreAction(ids).catch(() => ({ error: FAILED }));
  if (res.error) toast.notSaved(res.error);
  else toast.itemRestored(what, ids.length);
  return !res.error;
}

/**
 * Removes at once with an Undo toast, unless buyers hold one: then `held`
 * says how many, and the caller asks before remove(true).
 */
export function useRemove(ids: string[], what: string, done: () => void) {
  const [held, setHeld] = useState(0);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const remove = (force: boolean) =>
    start(async () => {
      const res = await removeAction(ids, force).catch(() => ({
        error: FAILED,
      }));
      if ("held" in res) return setHeld(res.held);
      setHeld(0);
      const why =
        "error" in res
          ? res.error
          : "event" in res
            ? `It's in the claim event ${res.event}. End the event first.`
            : "gone" in res
              ? "That item is not in your stock."
              : null;
      setError(why ?? undefined);
      if (why) return void toast.notSaved(why);
      toast.itemRemoved(what, ids.length, () => void restore(ids, what));
      done();
    });
  return { held, keep: () => setHeld(0), remove, pending, error };
}

/** The question before removing what buyers hold. */
export function HeldAsk(props: {
  held: number;
  many: boolean;
  pending: boolean;
  onKeep: () => void;
  onRemove: () => void;
}) {
  const { held, many } = props;
  return (
    <div className="flex flex-col gap-3">
      <p className="font-semibold">
        {held} {held === 1 ? "buyer has" : "buyers have"}{" "}
        {many ? "these" : "this"} on hold. Removing takes {many ? "them" : "it"}{" "}
        off their {held === 1 ? "request" : "requests"} and tells them.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          autoFocus
          onClick={props.onKeep}
          className={lineButton}
        >
          Keep
        </button>
        <button
          type="button"
          disabled={props.pending}
          onClick={props.onRemove}
          className={`${lineButton} text-danger`}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

export function EditPanel({
  row,
  onDone,
}: {
  row: StockRow;
  onDone: () => void;
}) {
  const [saveError, setError] = useState<string>();
  const [saving, start] = useTransition();
  const gone = useRemove([row.id], row.name, onDone);
  const { held } = gone;
  const pending = saving || gone.pending;
  const error = saveError ?? gone.error;
  const custom = row.catalogItemId === null;
  const save = (patch: Record<string, unknown>, done: () => void) =>
    start(async () => {
      const res = await updateListingAction({ id: row.id, ...patch });
      setError(res.error);
      if (res.error) return void toast.notSaved(res.error);
      done();
      onDone();
    });
  return (
    // A paper slip under the row: you are holding this item while you edit it.
    <Ticket
      as="div"
      className="mx-4 mb-4 [--stub:2rem] lg:ml-[116px] lg:max-w-lg"
    >
      <form
        data-panel
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const fixed = String(form.get("overridePrice") ?? "").trim();
          // Sent only when typed, so a stepper tap since opening isn't undone.
          const qty = String(form.get("qty") ?? "").trim();
          const typed = qty !== String(row.qty);
          const name = custom ? String(form.get("name") ?? "").trim() : "";
          const change = [
            typed && `Quantity ${qty}.`,
            fixed
              ? `Fixed price ${fixed.replace("$", "")}.`
              : "Follows the market.",
          ]
            .filter(Boolean)
            .join(" ");
          save(
            {
              ...(typed && { qty }),
              overridePrice: fixed,
              cost: form.get("cost"),
              ...(row.kind === "raw" && { condition: form.get("condition") }),
              ...(custom && {
                name,
                setName: form.get("setName"),
                ...(form.has("number") && { number: form.get("number") }),
              }),
            },
            () => toast.itemUpdated(name || row.name, change),
          );
        }}
      >
        {custom && <OwnFields row={row} />}
        <Fields row={row} />
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex flex-wrap gap-3">
          <TicketButton type="submit" disabled={pending} aria-busy={pending}>
            Save
          </TicketButton>
          <TicketButton
            variant="secondary"
            disabled={pending}
            onClick={() =>
              save({ active: !row.active }, () =>
                row.active
                  ? toast.itemHidden(row.name)
                  : toast.itemUpdated(row.name, "Back on your public table."),
              )
            }
          >
            {row.active ? "Hide from store" : "Show in store"}
          </TicketButton>
          <TicketButton
            variant="secondary"
            className="text-danger"
            disabled={pending || held > 0}
            onClick={() => gone.remove(false)}
          >
            Remove from inventory
          </TicketButton>
        </div>
        {held > 0 && (
          <HeldAsk
            held={held}
            many={false}
            pending={pending}
            onKeep={gone.keep}
            onRemove={() => gone.remove(true)}
          />
        )}
      </form>
      {custom && <Photo row={row} />}
    </Ticket>
  );
}

/** A custom item's own name, set and number; catalog cards take the catalog's. */
function OwnFields({ row }: { row: StockRow }) {
  const other = row.kind === "other";
  const id = (name: string) => `${name}-${row.id}`;
  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor={id("name")}>Name</Label>
        <Input
          id={id("name")}
          name="name"
          required
          maxLength={120}
          defaultValue={row.name}
        />
      </div>
      <div
        className={
          other ? "flex flex-col gap-2" : "grid grid-cols-[1fr_7rem] gap-3"
        }
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor={id("set")}>
            {other ? "Category (optional)" : "Set (optional)"}
          </Label>
          <Input
            id={id("set")}
            name="setName"
            maxLength={120}
            defaultValue={row.setName ?? ""}
          />
        </div>
        {!other && (
          <div className="flex flex-col gap-2">
            <Label htmlFor={id("number")}>Number</Label>
            <Input
              id={id("number")}
              name="number"
              maxLength={20}
              defaultValue={row.number ?? ""}
            />
          </div>
        )}
      </div>
    </>
  );
}

/** A custom item's own photo: catalog art comes from the price source. */
function Photo({ row }: { row: StockRow }) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const send = (form: FormData, done: string) =>
    start(async () => {
      form.set("id", row.id);
      const res = await setPhotoAction(form);
      setError(res.error);
      if (res.error) toast.notSaved(res.error);
      else toast.itemUpdated(row.name, done);
    });
  return (
    <form
      className="mt-5 flex flex-col gap-3 border-t border-dashed border-border-strong pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        send(new FormData(e.currentTarget), "Photo saved.");
      }}
    >
      <PhotoField id={`photo-${row.id}`} error={error} />
      <div className="flex flex-wrap gap-3">
        <TicketButton
          type="submit"
          variant="secondary"
          disabled={pending}
          aria-busy={pending}
        >
          {pending ? "Saving" : "Save photo"}
        </TicketButton>
        {row.imageUrl && (
          <TicketButton
            variant="secondary"
            disabled={pending}
            onClick={() => {
              const form = new FormData();
              form.set("remove", "1");
              send(form, "Photo removed.");
            }}
          >
            Remove photo
          </TicketButton>
        )}
      </div>
    </form>
  );
}

function Fields({ row }: { row: StockRow }) {
  const priceId = `price-${row.id}`;
  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`qty-${row.id}`}>Quantity</Label>
        <Input
          id={`qty-${row.id}`}
          name="qty"
          type="number"
          inputMode="numeric"
          min={0}
          max={9999}
          required
          defaultValue={row.qty}
          className="num w-28"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={priceId}>Fixed price (USD)</Label>
        <Input
          id={priceId}
          name="overridePrice"
          inputMode="decimal"
          defaultValue={row.overridePrice?.toFixed(2) ?? ""}
          placeholder="Use market price"
          aria-describedby={`${priceId}-hint`}
        />
        <p id={`${priceId}-hint`} className="text-sm text-muted-foreground">
          Leave blank to follow the market with your store rule.
        </p>
      </div>
      <CostField
        id={`cost-${row.id}`}
        defaultValue={row.cost?.toFixed(2) ?? ""}
      />
      {row.kind === "raw" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`cond-${row.id}`}>Condition</Label>
          <select
            id={`cond-${row.id}`}
            name="condition"
            defaultValue={row.condition ?? "NM"}
            className="h-12 bg-bg px-3 text-base shadow-[inset_0_0_0_1.5px_var(--border-strong)] focus-visible:shadow-[inset_0_0_0_2.5px_var(--focus)] focus-visible:outline-none"
          >
            {CONDITIONS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}

/** The vendor's own unit cost, here and on both add forms (priceSchema parses it). */
export function CostField({
  id,
  defaultValue,
  error,
}: {
  id: string;
  defaultValue?: string;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>What you paid, each (USD)</Label>
      <Input
        id={id}
        name="cost"
        inputMode="decimal"
        defaultValue={defaultValue}
        placeholder="Optional"
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-hint`}
      />
      <p
        id={`${id}-hint`}
        className={`text-sm ${error ? "text-danger" : "text-muted-foreground"}`}
      >
        {error ?? "Only you see this. It gives your ledger a profit figure."}
      </p>
    </div>
  );
}
