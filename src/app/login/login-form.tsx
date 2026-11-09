"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestMagicLink, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    requestMagicLink,
    {},
  );
  if (state.sent) {
    return (
      <div
        role="status"
        className="rounded-lg bg-surface p-5 shadow-1 ring-1 ring-border"
      >
        <p className="text-lg font-semibold">Check your email.</p>
        <p className="mt-1 text-muted-foreground">
          We sent a link to{" "}
          <strong className="break-all text-foreground">{state.sent}</strong>.
          It works for 5 minutes.
        </p>
      </div>
    );
  }
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
          aria-describedby={state.error ? "email-error" : undefined}
        />
        {state.error && (
          <p id="email-error" className="text-sm text-danger">
            {state.error}
          </p>
        )}
      </div>
      <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
        {pending ? "Sending link" : "Email me a link"}
      </Button>
    </form>
  );
}
