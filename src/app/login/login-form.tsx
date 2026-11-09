"use client";

import { useActionState, useEffect, useSyncExternalStore } from "react";
import { TicketButton } from "@/components/ticket-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";
import { requestMagicLink, type LoginState } from "./actions";

const EXPIRED =
  "That link has expired. Enter your email and we'll send a fresh one.";

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
    // A sent link swaps the form for the "Check your email" ticket, so no toast.
    if (state.limited) toast.rateLimited();
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
      <TicketButton type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Sending link" : "Email me a link"}
      </TicketButton>
    </form>
  );
}

function Sent({ email }: { email: string }) {
  return (
    // No role="status": the linkSent toast already announces it.
    <div className="flex flex-col gap-3">
      <p className="font-display text-[2.25rem] leading-[0.9] font-black">
        Check your email.
      </p>
      <p className="text-muted-foreground">
        We sent a link to{" "}
        <span className="font-semibold [overflow-wrap:anywhere] text-text">
          {email}
        </span>
        . It works once, for 5 minutes.
      </p>
      <p className="border-t border-dashed border-border pt-3 text-sm text-muted-foreground">
        Didn&apos;t get it? Check spam, or reload this page to send again.
      </p>
    </div>
  );
}
