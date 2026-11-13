"use client";

import { useActionState } from "react";
import { TicketButton } from "@/components/ticket-button";
import { NewPasswordFields } from "../login/login-form";
import { setPasswordAction, type WelcomeState } from "./actions";

export function WelcomeForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState<WelcomeState, FormData>(
    setPasswordAction,
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-4">
      {/* For password managers: saves the pair under the right account. */}
      <input
        type="email"
        name="email"
        value={email}
        autoComplete="username"
        readOnly
        hidden
      />
      <p className="text-sm text-muted-foreground">
        Signed in as{" "}
        <span className="font-semibold [overflow-wrap:anywhere] text-text">
          {email}
        </span>
      </p>
      <NewPasswordFields error={state.error} label="Password" />
      <TicketButton type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Saving" : "Save password"}
      </TicketButton>
    </form>
  );
}
