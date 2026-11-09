"use client";

import { useActionState } from "react";
import { TicketButton } from "@/components/ticket-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sent } from "../login/login-form";
import { requestInvite, type JoinState } from "./actions";

export function JoinForm({ code = "" }: { code?: string }) {
  const [state, action, pending] = useActionState<JoinState, FormData>(
    requestInvite,
    {},
  );
  if (state.sent)
    return (
      <Sent>
        We sent a link to{" "}
        <span className="font-semibold [overflow-wrap:anywhere] text-text">
          {state.sent}
        </span>
        . It works once, for 5 minutes. Wrong address? Reload and enter it again
        with the same code.
      </Sent>
    );
  const bad = (f: JoinState["field"]) => state.field === f || undefined;
  const described = state.error ? "join-error" : undefined;
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="code">Invite code</Label>
        <Input
          id="code"
          name="code"
          defaultValue={code}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          required
          maxLength={64}
          aria-invalid={bad("code")}
          aria-describedby={described}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          aria-invalid={bad("email")}
          aria-describedby={described}
        />
      </div>
      {state.error && (
        <p id="join-error" role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <TicketButton type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Sending link" : "Email me a link"}
      </TicketButton>
    </form>
  );
}
