"use client";

import { headingIcon } from "@/components/bento";
import { KeyRound } from "lucide-react";
import { useActionState } from "react";
import { TicketButton } from "@/components/ticket-button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { NewPasswordFields } from "../../login/login-form";
import { changePasswordAction, type PasswordState } from "./actions";

export function ChangePassword() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(
    changePasswordAction,
    {},
  );
  return (
    <section
      aria-labelledby="password-h"
      className="flex max-w-md flex-col gap-4 border-t border-border pt-6 lg:max-w-none lg:border-t-0 lg:pt-0"
    >
      <h2 id="password-h" className="text-lg font-semibold">
        <KeyRound aria-hidden className={headingIcon} />
        Change password
      </h2>
      {state.saved ? (
        <p role="status" className="font-semibold">
          Password changed. Other devices are signed out.
        </p>
      ) : (
        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="current">Current password</Label>
            <PasswordInput
              id="current"
              name="current"
              autoComplete="current-password"
              required
            />
          </div>
          <NewPasswordFields error={state.error} />
          <TicketButton
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="self-start"
          >
            {pending ? "Saving" : "Change password"}
          </TicketButton>
        </form>
      )}
    </section>
  );
}
