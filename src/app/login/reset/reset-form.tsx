"use client";

import Link from "next/link";
import { useActionState, useSyncExternalStore } from "react";
import { TicketButton } from "@/components/ticket-button";
import { resetAction, type ResetState } from "../actions";
import { authLink } from "../auth-shell";
import { NewPasswordFields } from "../login-form";

// The token arrives as ?token=; read on the client so the page stays static.
const subscribe = () => () => {};
const token = () => new URLSearchParams(location.search).get("token") ?? "";

export function ResetForm() {
  const [state, action, pending] = useActionState<ResetState, FormData>(
    resetAction,
    {},
  );
  const t = useSyncExternalStore(subscribe, token, () => "");
  if (state.expired)
    return (
      <div role="alert" className="flex flex-col gap-3">
        <p className="font-semibold">{state.error}</p>
        <Link href="/login/forgot" className={`self-start ${authLink}`}>
          Send a new link
        </Link>
      </div>
    );
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={t} />
      <NewPasswordFields error={state.error} />
      <TicketButton type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Saving" : "Save and sign in"}
      </TicketButton>
    </form>
  );
}
