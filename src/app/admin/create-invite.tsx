"use client";

import { useActionState } from "react";
import { TicketButton } from "@/components/ticket-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CopyLink } from "../dashboard/copy-link";
import { createInviteAction, type CreateState } from "./actions";

export function CreateInvite() {
  const [state, action, pending] = useActionState<CreateState, FormData>(
    createInviteAction,
    {},
  );
  return (
    <div className="flex flex-col gap-5">
      <form action={action} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="label">Who&apos;s it for? (optional)</Label>
          <Input id="label" name="label" maxLength={80} autoComplete="off" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="invite-email">Email it to (optional)</Label>
          <Input
            id="invite-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="off"
            aria-describedby="invite-email-hint"
          />
          <p id="invite-email-hint" className="text-sm text-muted-foreground">
            We email them a link to set up their account. Leave it empty to
            share the code yourself.
          </p>
        </div>
        {state.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
        <TicketButton type="submit" disabled={pending} aria-busy={pending}>
          {pending ? "Creating" : "Create invite"}
        </TicketButton>
      </form>
      {state.code && state.link && (
        <div
          role="status"
          className="flex flex-col gap-3 border-t border-dashed border-border pt-4"
        >
          <p className="font-semibold [overflow-wrap:anywhere]">
            {state.emailed
              ? `Emailed to ${state.emailed}. The code below only works for that address.`
              : "Send this now. It won't be shown again."}
          </p>
          <p
            data-testid="invite-code"
            className="font-display text-[1.75rem] leading-none font-extrabold [overflow-wrap:anywhere]"
          >
            {state.code}
          </p>
          <div className="flex items-center justify-between gap-3">
            <span
              data-testid="invite-link"
              className="min-w-0 text-sm [overflow-wrap:anywhere]"
            >
              {state.link}
            </span>
            <CopyLink url={state.link} />
          </div>
        </div>
      )}
    </div>
  );
}
