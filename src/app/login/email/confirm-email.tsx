"use client";

import Link from "next/link";
import { useActionState, useSyncExternalStore } from "react";
import { TicketButton } from "@/components/ticket-button";
import { confirmEmailAction, type ConfirmEmailState } from "../actions";
import { authLink } from "../auth-shell";

// A button, not on load: mail scanners open links, and that mustn't change the account.
const subscribe = () => () => {};
const token = () => new URLSearchParams(location.search).get("token") ?? "";

export function ConfirmEmail() {
  const [state, action, pending] = useActionState<ConfirmEmailState, FormData>(
    confirmEmailAction,
    {},
  );
  const t = useSyncExternalStore(subscribe, token, () => "");
  if (state.done)
    return (
      <div role="status" className="flex flex-col gap-3">
        <p className="font-semibold [overflow-wrap:anywhere]">
          Done. Sign in with {state.done} from now on. Your password is the
          same.
        </p>
        <Link href="/dashboard" className={`self-start ${authLink}`}>
          Go to your dashboard
        </Link>
      </div>
    );
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={t} />
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <TicketButton type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Confirming" : "Confirm new email"}
      </TicketButton>
    </form>
  );
}
