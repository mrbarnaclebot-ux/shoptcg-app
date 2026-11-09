"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { slugSchema } from "@/lib/slug";
import { createStoreAction, type CreateStoreState } from "./actions";

// Nudges typed text toward a valid slug; the zod schema still has the final say.
function toSlug(value: string) {
  return value.toLowerCase().replace(/\s+/g, "-");
}

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
          placeholder="Ridgeline Cards"
        />
        <FieldError id="name-error" message={state.errors?.name} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="slug">Store link</Label>
        <div className="flex h-12 items-center rounded-md border border-input bg-surface-2 pl-3.5 focus-within:ring-2 focus-within:ring-ring has-aria-invalid:border-destructive">
          <span className="text-base text-subtle select-none">
            shoptcg.app/
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
            className="h-full rounded-none border-0 bg-transparent pl-0.5 focus-visible:ring-0 aria-invalid:ring-0"
          />
        </div>
        <p id="slug-hint" className="text-sm text-subtle">
          Lowercase letters, numbers and dashes.
        </p>
        <FieldError id="slug-error" message={slugError} />
      </div>
      <FieldError id="form-error" message={state.errors?.form} />
      <Button
        type="submit"
        size="lg"
        disabled={pending || check?.success === false}
        aria-busy={pending}
      >
        {pending ? "Creating store" : "Create store"}
      </Button>
      <p className="text-sm text-subtle">
        By creating a store you agree to the{" "}
        <Link href="/terms" className="text-brand-text underline">
          Terms
        </Link>
        .
      </p>
    </form>
  );
}
