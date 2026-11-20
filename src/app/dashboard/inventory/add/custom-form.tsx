"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { Segmented } from "@/components/segmented";
import { TicketButton } from "@/components/ticket-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CONDITIONS } from "@/lib/condition";
import { toast } from "@/lib/toast";
import { addCustomAction, type CustomState } from "../actions";
import { Added, OFFLINE, StockFields } from "./add-panel";

type Kind = "raw" | "graded" | "sealed" | "other";

function Field(props: {
  name: string;
  label: string;
  error?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={props.name}>{props.label}</Label>
      <Input
        id={props.name}
        name={props.name}
        placeholder={props.placeholder}
        required={props.required}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={props.error ? `${props.name}-error` : undefined}
      />
      {props.error && (
        <p id={`${props.name}-error`} className="text-sm text-danger">
          {props.error}
        </p>
      )}
    </div>
  );
}

// For what no price source covers: Chinese products, odd slabs, and other
// things a store sells (sleeves, toploaders, die-cast). The vendor sets the
// price, since there is no market price to follow.
export function CustomForm() {
  const [kind, setKind] = useState<Kind>("raw");
  const other = kind === "other";
  const [state, action, pending] = useActionState<CustomState, FormData>(
    // Offline, the call itself fails: say so and keep what was typed (same n).
    (prev, form) =>
      addCustomAction(prev, form).catch(() => ({
        n: prev.n,
        errors: { form: OFFLINE },
      })),
    {},
  );
  const e = state.errors ?? {};
  useEffect(() => {
    // A save shows the inline confirmation instead of a toast.
    if (state.errors?.form) toast.notSaved(state.errors.form);
  }, [state]);
  return (
    // noValidate: the server's field errors render in the house style instead
    // of the browser's validation bubble.
    <form
      key={state.n ?? 0}
      action={action}
      // A form action resets the fields even when the server refuses them, so
      // a bad photo would wipe the rest. Dispatch by hand: a success still
      // clears the form, through the key above.
      onSubmit={(ev) => {
        ev.preventDefault();
        const data = new FormData(ev.currentTarget);
        startTransition(() => action(data));
      }}
      noValidate
      className="flex flex-col gap-5"
    >
      {state.added && !pending && (
        <Added name={state.added.name} first={state.added.first} />
      )}
      <Field
        name="name"
        label="Name"
        required
        error={e.name}
        placeholder={other ? "Penny sleeves, 100 pack" : "Pikachu promo"}
      />
      <KindFields kind={kind} setKind={setKind} errors={e} />
      {other ? (
        <Field
          name="setName"
          label="Category (optional)"
          placeholder="e.g. Supplies, Hot Wheels"
          error={e.setName}
        />
      ) : (
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <Field name="setName" label="Set (optional)" error={e.setName} />
          <Field name="number" label="Number" error={e.number} />
        </div>
      )}
      <PhotoField error={e.photo} />
      <StockFields errors={e} />
      <p className="text-sm text-muted-foreground">
        Custom items have no market price, so set a fixed price or add one
        later.
      </p>
      {e.form && <p className="text-sm font-semibold text-danger">{e.form}</p>}
      <TicketButton
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="self-start"
      >
        {pending ? "Adding" : "Add custom item"}
      </TicketButton>
    </form>
  );
}

// Type decides which of condition or grader + grade the item carries.
function KindFields({
  kind,
  setKind,
  errors: e,
}: {
  kind: Kind;
  setKind: (k: Kind) => void;
  errors: Record<string, string>;
}) {
  const [language, setLanguage] = useState("en");
  const [condition, setCondition] = useState("NM");
  return (
    <>
      <Segmented
        name="kind"
        label="Type"
        value={kind}
        onChange={setKind}
        options={[
          ["raw", "Raw"],
          ["graded", "Graded"],
          ["sealed", "Sealed"],
          ["other", "Other"],
        ]}
      />
      {kind !== "other" && (
        <Segmented
          name="language"
          label="Language"
          value={language}
          onChange={setLanguage}
          options={[
            ["en", "English"],
            ["ja", "Japanese"],
            ["zh", "Chinese"],
          ]}
        />
      )}
      {kind === "raw" && (
        <Segmented
          name="condition"
          label="Condition"
          value={condition}
          onChange={setCondition}
          options={CONDITIONS.map((c) => [c, c] as const)}
        />
      )}
      {kind === "graded" && (
        <div className="grid grid-cols-2 gap-3">
          <Field
            name="grader"
            label="Grader"
            placeholder="e.g. PSA, ACE, TAG"
            error={e.grader}
          />
          <Field
            name="grade"
            label="Grade"
            placeholder="e.g. 10"
            error={e.grade}
          />
        </div>
      )}
    </>
  );
}

/** A photo from the phone's camera or files; the server re-encodes it. */
export function PhotoField(props: { id?: string; error?: string }) {
  const id = props.id ?? "photo";
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>Photo (optional)</Label>
      <input
        id={id}
        name="photo"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-invalid={props.error ? true : undefined}
        aria-describedby={`${id}-hint${props.error ? ` ${id}-error` : ""}`}
        className="text-sm file:mr-3 file:min-h-11 file:cursor-pointer file:border-0 file:bg-transparent file:px-4 file:font-semibold file:shadow-[inset_0_0_0_1.5px_currentColor]"
      />
      <p id={`${id}-hint`} className="text-sm text-muted-foreground">
        JPEG, PNG or WebP, up to 4 MB. Shown whole on your store page.
      </p>
      {props.error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {props.error}
        </p>
      )}
    </div>
  );
}
