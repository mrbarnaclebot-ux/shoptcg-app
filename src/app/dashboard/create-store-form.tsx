"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { TicketButton } from "@/components/ticket-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { slugSchema, toSlug } from "@/lib/slug";
import { toast } from "@/lib/toast";
import { createStoreAction, type CreateStoreState } from "./actions";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-danger">
      {message}
    </p>
  );
}

export function CreateStoreForm() {
  const [state, action, pending] = useActionState<CreateStoreState, FormData>(
    createStoreAction,
    {},
  );
  const [slug, setSlug] = useState("");
  useEffect(() => {
    if (state.taken) toast.slugTaken(state.taken);
  }, [state]);
  const check = slug ? slugSchema.safeParse(slug) : null;
  const slugError =
    check?.success === false
      ? check.error.issues[0]?.message
      : state.errors?.slug;

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Store name</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={80}
          placeholder="e.g. Ridgeline Cards"
        />
        <FieldError id="name-error" message={state.errors?.name} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="slug">Store link</Label>
        <div className="flex h-12 items-center bg-bg pl-3.5 shadow-[inset_0_0_0_1.5px_var(--border-strong)] focus-within:shadow-[inset_0_0_0_2.5px_var(--focus)] has-aria-invalid:shadow-[inset_0_0_0_2px_var(--danger)]">
          <span className="text-base text-muted-foreground select-none">
            tcgmart.app/
          </span>
          <Input
            id="slug"
            name="slug"
            required
            maxLength={40}
            placeholder="your-store"
            value={slug}
            onChange={(e) => setSlug(toSlug(e.target.value))}
            aria-invalid={slugError ? true : undefined}
            aria-describedby="slug-hint slug-error"
            className="h-full bg-transparent pl-0.5 shadow-none focus-visible:shadow-none aria-invalid:shadow-none"
          />
        </div>
        <p id="slug-hint" className="text-sm text-muted-foreground">
          Lowercase letters, numbers and dashes.
        </p>
        <FieldError id="slug-error" message={slugError} />
      </div>
      <FieldError id="form-error" message={state.errors?.form} />
      <TicketButton
        type="submit"
        disabled={pending || check?.success === false}
        aria-busy={pending}
      >
        {pending ? "Creating store" : "Create store"}
      </TicketButton>
      <p className="text-sm text-muted-foreground">
        By creating a store you agree to the{" "}
        <Link
          href="/terms"
          className="text-text underline decoration-brand-text decoration-[1.5px] underline-offset-4"
        >
          Terms
        </Link>
        .
      </p>
    </form>
  );
}
