"use client";

import { useActionState } from "react";
import { lineButton, TicketButton } from "@/components/ticket-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  changeEmailAction,
  deleteAccountAction,
  type DeleteState,
  type EmailState,
} from "./actions";

function Current({ id }: { id: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>Your password</Label>
      <Input
        id={id}
        name="current"
        type="password"
        autoComplete="current-password"
        required
      />
    </div>
  );
}

export function ChangeEmail() {
  const [state, action, pending] = useActionState<EmailState, FormData>(
    changeEmailAction,
    {},
  );
  return (
    <section
      aria-labelledby="email-h"
      className="flex max-w-md flex-col gap-4 border-t border-border pt-6 lg:max-w-none lg:border-t-0 lg:pt-0"
    >
      <h2 id="email-h" className="text-lg font-semibold">
        Change email
      </h2>
      {state.sent ? (
        <p role="status" className="font-semibold [overflow-wrap:anywhere]">
          We sent a link to {state.sent}. Open it within an hour to switch.
          Until then, keep signing in with your current email.
        </p>
      ) : (
        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-email">New email</Label>
            <Input
              id="new-email"
              name="email"
              defaultValue={state.email}
              type="email"
              inputMode="email"
              autoComplete="email"
              required
            />
          </div>
          <Current id="email-current" />
          {state.error && (
            <p role="alert" className="text-sm text-danger">
              {state.error}
            </p>
          )}
          <TicketButton
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="self-start"
          >
            {pending ? "Sending" : "Send confirm link"}
          </TicketButton>
        </form>
      )}
    </section>
  );
}

export function DeleteAccount() {
  const [state, action, pending] = useActionState<DeleteState, FormData>(
    deleteAccountAction,
    {},
  );
  return (
    <section
      aria-labelledby="delete-h"
      className="flex max-w-md flex-col gap-4 border-t border-border pt-6 lg:max-w-none lg:border-t-0 lg:pt-0"
    >
      <h2 id="delete-h" className="text-lg font-semibold text-danger">
        Delete account
      </h2>
      <p className="text-sm text-muted-foreground">
        Deletes your account, your store page, all stock, sales, buys and
        customer records. It can&apos;t be undone. Export anything you need from
        Sales and Ledger first.
      </p>
      <form action={action} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="delete-confirm">
            Type &ldquo;delete my account&rdquo;
          </Label>
          <Input
            id="delete-confirm"
            name="confirm"
            autoComplete="off"
            required
          />
        </div>
        <Current id="delete-current" />
        {state.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className={`${lineButton} self-start text-danger`}
        >
          {pending ? "Deleting" : "Delete my account"}
        </button>
      </form>
    </section>
  );
}
