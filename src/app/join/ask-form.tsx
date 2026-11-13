"use client";

import { useActionState } from "react";
import { TicketButton } from "@/components/ticket-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { askForInvite, type AskState } from "./actions";

/** "No code yet?": a request the admin answers from /admin. */
export function AskForm() {
  const [state, action, pending] = useActionState<AskState, FormData>(
    askForInvite,
    {},
  );
  if (state.sent)
    return (
      <p role="status" className="font-semibold">
        Thanks. We&apos;ve emailed you to confirm, and we&apos;ll email your
        invite once it&apos;s approved.
      </p>
    );
  const bad = (f: string) => state.field === f || undefined;
  const described = state.error ? "ask-error" : undefined;
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="ask-name">Your name</Label>
        <Input
          id="ask-name"
          name="name"
          autoComplete="name"
          required
          maxLength={80}
          aria-invalid={bad("name")}
          aria-describedby={described}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="ask-email">Email</Label>
        <Input
          id="ask-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          aria-invalid={bad("email")}
          aria-describedby={described}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="ask-about">How do you sell? (optional)</Label>
        <textarea
          id="ask-about"
          name="about"
          rows={3}
          maxLength={500}
          placeholder="Shows you do, your socials or online shop"
          className="w-full bg-bg px-3.5 py-2.5 text-base text-text shadow-[inset_0_0_0_1.5px_var(--border-strong)] outline-none placeholder:text-subtle focus-visible:shadow-[inset_0_0_0_2.5px_var(--focus)]"
        />
      </div>
      {state.error && (
        <p id="ask-error" role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <TicketButton type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Sending" : "Ask for an invite"}
      </TicketButton>
    </form>
  );
}
