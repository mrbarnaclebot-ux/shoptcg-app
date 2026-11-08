"use client";

import { Check } from "lucide-react";
import { useActionState, useState } from "react";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CONDITIONS } from "@/lib/listing-input";
import { addCustomAction, type CustomState } from "../actions";
import { StockFields } from "./add-panel";

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
  return (
    <form key={state.n ?? 0} action={action} className="flex flex-col gap-5">
      {state.added && !pending && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg bg-success-bg p-4 font-semibold text-success"
        >
          <Check aria-hidden className="size-5" />
          Added {state.added} to your stock.
        </p>
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
      <p className="text-sm text-subtle">
        Custom items have no market price, so set a fixed price or add one
        later.
      </p>
      <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
        {pending ? "Adding" : "Add custom item"}
      </Button>
    </form>
  );
}

// Type decides which of condition or grader + grade the item carries.
function KindFields({ errors: e }: { errors: Record<string, string> }) {
  const [kind, setKind] = useState<Kind>("raw");
  const [language, setLanguage] = useState("zh");
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
          ["zh", "Chinese"],
          ["ja", "Japanese"],
          ["en", "English"],
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
