"use client";

import Link from "next/link";
import {
  type ReactNode,
  useActionState,
  useState,
  useSyncExternalStore,
} from "react";
import { lineButton, TicketButton } from "@/components/ticket-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { signInAction, type LoginState } from "./actions";
import { authLink } from "./auth-shell";

// /login?reset=1 after a reset that couldn't sign in by itself, ?deleted=1
// after deleting the account. Read on the client so the page stays static.
const subscribe = () => () => {};
const arrived = () => {
  const q = new URLSearchParams(location.search);
  if (q.has("deleted")) return "Your account was deleted.";
  return q.has("reset") ? "Password saved. Sign in with it." : "";
};

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    signInAction,
    {},
  );
  const note = useSyncExternalStore(subscribe, arrived, () => "");
  const error = state.error;
  return (
    <form action={action} className="flex flex-col gap-4">
      {note && !error && (
        <p role="status" className="font-semibold">
          {note}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          defaultValue={state.email}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "login-error" : undefined}
        />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/login/forgot"
            className={`inline-flex min-h-11 items-center text-sm ${authLink}`}
          >
            Forgot password?
          </Link>
        </div>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "login-error" : undefined}
        />
      </div>
      {error && (
        <p id="login-error" role="alert" className="text-sm text-danger">
          {error}{" "}
          <Link href="/login/forgot" className={authLink}>
            Set a new password
          </Link>
          .
        </p>
      )}
      <TicketButton type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Signing in" : "Sign in"}
      </TicketButton>
    </form>
  );
}

/** A new password typed twice: welcome, reset and settings. */
export function NewPasswordFields({
  error,
  label = "New password",
}: {
  error?: string;
  label?: string;
}) {
  const described = error ? "password-error" : "password-hint";
  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{label}</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
        />
        <p id="password-hint" className="text-sm text-muted-foreground">
          At least 8 characters.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm">Type it again</Label>
        <PasswordInput
          id="confirm"
          name="confirm"
          autoComplete="new-password"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "password-error" : undefined}
        />
      </div>
      {error && (
        <p id="password-error" role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </>
  );
}

/**
 * "Check your email". Send again posts what was sent through the same action,
 * so the same sign-in limits apply; Use a different email goes back to the form.
 */
export function Sent(props: {
  children: ReactNode;
  action: (form: FormData) => void;
  pending: boolean;
  resend: Record<string, string>;
  onReset: () => void;
}) {
  const [again, setAgain] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <div role="status" className="flex flex-col gap-3">
        <p className="font-display text-[2.25rem] leading-[0.9] font-black">
          Check your email.
        </p>
        <p className="text-muted-foreground">{props.children}</p>
        {again && !props.pending && (
          <p className="text-sm font-semibold">Sent again.</p>
        )}
      </div>
      <form
        action={props.action}
        onSubmit={() => setAgain(true)}
        className="flex flex-col gap-3 border-t border-dashed border-border pt-3"
      >
        {Object.entries(props.resend).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <p className="text-sm text-muted-foreground">
          Didn&apos;t get it? Check spam, or send it again.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={props.pending}
            aria-busy={props.pending}
            className={lineButton}
          >
            {props.pending ? "Sending" : "Send again"}
          </button>
          <button type="button" onClick={props.onReset} className={lineButton}>
            Use a different email
          </button>
        </div>
      </form>
    </div>
  );
}
