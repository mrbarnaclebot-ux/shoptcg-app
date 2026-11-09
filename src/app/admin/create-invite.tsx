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
          <p className="font-semibold">
            Send this now. It won&apos;t be shown again.
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
