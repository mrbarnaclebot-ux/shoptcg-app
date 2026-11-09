"use client";

import {
  type ReactNode,
  useActionState,
  useEffect,
  useSyncExternalStore,
} from "react";
import { TicketButton } from "@/components/ticket-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";
import { requestMagicLink, type LoginState } from "./actions";

const EXPIRED =
  "That link has expired. Enter your email and we'll send a fresh one.";
const NO_INVITE =
  "That link needs an active invite, and this one was used or cancelled. Ask for a new code.";

// Refused links land on /login?link=expired (errorCallbackURL in sign-in-link.ts),
// with error=INVITE_REQUIRED when no active invite was left to claim. Read once
// on the client, so the page stays static and the message outlives the URL clean-up.
let arrived: string | null | undefined;
function linkProblem() {
  if (arrived !== undefined) return arrived;
  const q = new URLSearchParams(location.search);
  if (q.get("error") === "INVITE_REQUIRED") arrived = NO_INVITE;
  else arrived = q.get("link") === "expired" ? EXPIRED : null;
  return arrived;
}

function useLinkProblem() {
  const problem = useSyncExternalStore(
    () => () => {},
    linkProblem,
    () => null,
  );
  useEffect(() => {
    const url = new URL(location.href);
    // Checked again: dev Strict Mode runs this effect twice.
    if (!problem || !url.searchParams.has("link")) return;
    for (const k of ["link", "error", "error_description"])
      url.searchParams.delete(k);
    history.replaceState(null, "", url);
    if (problem === EXPIRED) toast.linkExpired();
  }, [problem]);
  return problem;
}

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    requestMagicLink,
    {},
  );
  const problem = useLinkProblem();
  useEffect(() => {
    // A sent link swaps the form for the "Check your email" ticket, so no toast.
    if (state.limited) toast.rateLimited();
    else if (state.failed && state.error) toast.sendFailed(state.error);
  }, [state]);
  if (state.sent)
    return (
      <Sent>
        If this address has a vendor account, we sent a link. It works once, for
        5 minutes.
      </Sent>
    );
  const error = state.error ?? problem ?? undefined;
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

export function Sent({ children }: { children: ReactNode }) {
  return (
    // No role="status": the linkSent toast already announces it.
    <div className="flex flex-col gap-3">
      <p className="font-display text-[2.25rem] leading-[0.9] font-black">
        Check your email.
      </p>
      <p className="text-muted-foreground">{children}</p>
      <p className="border-t border-dashed border-border pt-3 text-sm text-muted-foreground">
        Didn&apos;t get it? Check spam, or reload this page to send again.
      </p>
    </div>
  );
}
