"use client";

import { useActionState, useEffect, useSyncExternalStore } from "react";
import { TicketButton } from "@/components/ticket-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";
import { Sent } from "../login/login-form";
import { requestInvite, type JoinState } from "./actions";

const EXPIRED =
  "That link has expired. Enter your code and email and we'll send a fresh one.";
const NO_INVITE =
  "That link needs an active invite, and this one was used or cancelled. Ask for a new code.";

// Refused invite links land on /join?link=expired (errorCallbackURL in
// sign-in-link.ts), with error=INVITE_REQUIRED when no active invite was left.
// Read once on the client, so the page stays static and the message outlives
// the URL clean-up.
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
    if (!problem || !url.searchParams.has("link")) return;
    for (const k of ["link", "error", "error_description"])
      url.searchParams.delete(k);
    history.replaceState(null, "", url);
    if (problem === EXPIRED) toast.linkExpired();
  }, [problem]);
  return problem;
}

export function JoinForm({ code = "" }: { code?: string }) {
  const [state, action, pending] = useActionState<JoinState, FormData>(
    requestInvite,
    {},
  );
  const problem = useLinkProblem();
  if (state.sent)
    return (
      <Sent>
        We sent a link to{" "}
        <span className="font-semibold [overflow-wrap:anywhere] text-text">
          {state.sent}
        </span>
        . Open it to set up your account and choose a password. It works once,
        for 48 hours. Wrong address? Reload and enter it again with the same
        code.
      </Sent>
    );
  const bad = (f: JoinState["field"]) => state.field === f || undefined;
  const described = state.error || problem ? "join-error" : undefined;
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
      {(state.error ?? problem) && (
        <p id="join-error" role="alert" className="text-sm text-danger">
          {state.error ?? problem}
        </p>
      )}
      <TicketButton type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Sending link" : "Email me a link"}
      </TicketButton>
    </form>
  );
}
