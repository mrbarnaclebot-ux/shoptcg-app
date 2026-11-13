"use client";

import Link from "next/link";
import { type ReactNode, useActionState, useSyncExternalStore } from "react";
import { TicketButton } from "@/components/ticket-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInAction, type LoginState } from "./actions";
import { authLink } from "./auth-shell";

// /login?reset=1 after a reset that couldn't sign in by itself. Read on the
// client so the page stays static.
const subscribe = () => () => {};
const resetDone = () => new URLSearchParams(location.search).has("reset");

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    signInAction,
    {},
  );
  const reset = useSyncExternalStore(subscribe, resetDone, () => false);
  const error = state.error;
  return (
    <form action={action} className="flex flex-col gap-4">
      {reset && !error && (
        <p role="status" className="font-semibold">
          Password saved. Sign in with it.
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
        <Input
          id="password"
          name="password"
          type="password"
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
        <Input
          id="password"
          name="password"
          type="password"
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
        <Input
          id="confirm"
          name="confirm"
          type="password"
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

export function Sent({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="flex flex-col gap-3">
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
