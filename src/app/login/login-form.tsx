"use client";

import { useActionState, useEffect, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";
import { requestMagicLink, type LoginState } from "./actions";

const EXPIRED = "That link expired or was already used. Request a new one.";

// Expired links land on /login?link=expired (errorCallbackURL in actions.ts).
// Read on the client so the login page stays static.
function useExpiredLink() {
  const expired = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(location.search).get("link") === "expired",
    () => false,
  );
  useEffect(() => {
    const url = new URL(location.href);
    // Checked again: dev Strict Mode runs this effect twice.
    if (!expired || !url.searchParams.has("link")) return;
    url.searchParams.delete("link");
    history.replaceState(null, "", url);
    toast.linkExpired();
  }, [expired]);
  return expired;
}

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    requestMagicLink,
    {},
  );
  const expired = useExpiredLink();
  useEffect(() => {
    if (state.sent) toast.linkSent(state.sent);
    else if (state.limited) toast.rateLimited();
    else if (state.failed && state.error) toast.sendFailed(state.error);
  }, [state]);
  if (state.sent) return <Sent email={state.sent} />;
  const error = state.error ?? (expired ? EXPIRED : undefined);
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
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "email-error" : undefined}
        />
        {error && (
          <p id="email-error" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
      <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
        {pending ? "Sending link" : "Email me a link"}
      </Button>
    </form>
  );
}

function Sent({ email }: { email: string }) {
  return (
    // No role="status": the linkSent toast already announces it.
    <div className="flex flex-col rounded-sm bg-surface ring-1 ring-border">
      <div className="flex items-baseline justify-between gap-3 border-b border-border px-5 py-3">
        <p className="text-lg font-bold wdth-112">Link sent.</p>
        <p className="num text-xs text-subtle">VALID 5 MIN</p>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 px-5 py-4 text-sm">
        <dt className="text-subtle">To</dt>
        <dd className="text-right font-semibold break-all">{email}</dd>
        <dt className="text-subtle">Use</dt>
        <dd className="text-right font-semibold">Single, this device or any</dd>
      </dl>
      <div aria-hidden className="ruler mx-5 mb-4" />
    </div>
  );
}
