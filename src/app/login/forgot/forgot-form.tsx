"use client";

import { useActionState } from "react";
import { TicketButton } from "@/components/ticket-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotAction, type ForgotState } from "../actions";
import { Sent } from "../login-form";

export function ForgotForm() {
  const [state, action, pending] = useActionState<ForgotState, FormData>(
    forgotAction,
    {},
  );
  if (state.sent)
    return (
      <Sent>
        If this address has a vendor account, we sent a link to set your
        password. It works once, for 1 hour.
      </Sent>
    );
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "forgot-error" : undefined}
        />
        {state.error && (
          <p id="forgot-error" role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
      </div>
      <TicketButton type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Sending link" : "Email me a link"}
      </TicketButton>
    </form>
  );
}
