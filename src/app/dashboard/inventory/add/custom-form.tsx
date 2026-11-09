"use client";

import { useActionState, useEffect, useState } from "react";
import { Segmented } from "@/components/segmented";
import { TicketButton } from "@/components/ticket-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CONDITIONS } from "@/lib/listing-input";
import { toast } from "@/lib/toast";
import { addCustomAction, type CustomState } from "../actions";
import { Added, StockFields } from "./add-panel";

type Kind = "raw" | "graded" | "sealed";

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

// For what no price source covers: Chinese products and odd slabs. The vendor
// sets the price, since there is no market price to follow.
export function CustomForm() {
  const [state, action, pending] = useActionState<CustomState, FormData>(
    addCustomAction,
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
        placeholder="Pikachu promo"
      />
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <Field name="setName" label="Set (optional)" error={e.setName} />
        <Field name="number" label="Number" error={e.number} />
      </div>
      <KindFields errors={e} />
      <Field
        name="imageUrl"
        label="Image link (optional)"
        placeholder="https://"
        error={e.imageUrl}
      />
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
function KindFields({ errors: e }: { errors: Record<string, string> }) {
  const [kind, setKind] = useState<Kind>("raw");
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
        ]}
      />
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
            placeholder="PSA, ACE, TAG"
            error={e.grader}
          />
          <Field name="grade" label="Grade" placeholder="10" error={e.grade} />
        </div>
      )}
    </>
  );
}
