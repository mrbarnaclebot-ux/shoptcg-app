"use client";

import { type ComponentProps, useState } from "react";
import { Input } from "./input";

/**
 * A password field with Show / Hide, for typing a long one on a phone at a
 * show. Only the type changes, so autocomplete (current- or new-password)
 * still tells password managers what the field is.
 */
export function PasswordInput(props: Omit<ComponentProps<"input">, "type">) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={shown ? "text" : "password"} className="pr-20" />
      <button
        type="button"
        aria-controls={props.id}
        onClick={() => setShown(!shown)}
        className="absolute inset-y-0 right-0 flex min-w-16 items-center justify-center px-3 text-sm font-semibold underline decoration-brand decoration-[1.5px] underline-offset-4"
      >
        {shown ? "Hide" : "Show"}
        <span className="sr-only"> password</span>
      </button>
    </div>
  );
}
