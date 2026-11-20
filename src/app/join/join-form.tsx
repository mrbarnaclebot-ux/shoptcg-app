"use client";

import {
  useActionState,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { Segmented } from "@/components/segmented";
import { TicketButton } from "@/components/ticket-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";
import { Sent } from "../login/login-form";
import { requestInvite, type JoinState } from "./actions";
import { AskForm } from "./ask-form";

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

type Tab = "code" | "ask";
const TABS = [
  ["code", "I have a code"],
  ["ask", "Ask for one"],
] as const;

// The code form when a refused invite link says why there; ask for an old
// "No code yet?" link (#ask-h). Otherwise the page decides.
const arrivedTab = (): Tab | null =>
  linkProblem() ? "code" : location.hash === "#ask-h" ? "ask" : null;

/** One ticket, two forms: ask for an invite, or use the code in the link. */
export function JoinTabs({ code }: { code?: string }) {
  const arrived = useSyncExternalStore(
    () => () => {},
    arrivedTab,
    () => null,
  );
  const [picked, setPicked] = useState<Tab>();
  const tab = picked ?? arrived ?? (code === undefined ? "ask" : "code");
  return (
    <div className="flex flex-col gap-5">
      <Segmented
        label="Your invite"
        value={tab}
        options={TABS}
        onChange={setPicked}
      />
      {tab === "code" ? <JoinForm code={code} /> : <AskForm />}
    </div>
  );
}

function JoinForm({ code = "" }: { code?: string }) {
  const [state, action, pending] = useActionState<JoinState, FormData>(
    requestInvite,
    {},
  );
  // "Use a different email" sets aside this answer; the next one shows.
  const [dismissed, setDismissed] = useState<JoinState>();
  const arrived = useLinkProblem();
  if (state.sent && state !== dismissed)
    return (
      <Sent
        action={action}
        pending={pending}
        resend={{ code: state.code ?? code, email: state.sent }}
        onReset={() => setDismissed(state)}
      >
        We sent a link to{" "}
        <span className="font-semibold [overflow-wrap:anywhere] text-text">
          {state.sent}
        </span>
        . Open it to set up your account and choose a password. It works once,
        for 48 hours.
      </Sent>
    );
  const problem = dismissed ? null : arrived;
  const bad = (f: JoinState["field"]) => state.field === f || undefined;
  const described = state.error || problem ? "join-error" : undefined;
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="code">Invite code</Label>
        <Input
          id="code"
          name="code"
          defaultValue={dismissed?.code ?? code}
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
          // Back from "Use a different email": the button that had focus is gone.
          autoFocus={dismissed !== undefined}
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
