"use client";

import { useActionState, useEffect } from "react";
import { lineButton } from "@/components/ticket-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";
import { saveTableLabelAction, type TableState } from "./actions";

export function TableForm({ value }: { value: string }) {
  const [state, action, pending] = useActionState<TableState, FormData>(
    saveTableLabelAction,
    {},
  );
  useEffect(() => {
    if (state.saved !== undefined) toast.tableSaved(state.saved);
    else if (state.error) toast.notSaved(state.error);
  }, [state]);
  return (
    <form action={action} className="flex flex-col gap-2">
      <Label htmlFor="tableLabel">Table number</Label>
      <div className="flex gap-2">
        <Input
          id="tableLabel"
          name="tableLabel"
          defaultValue={value}
          maxLength={8}
          placeholder="B14"
          autoCapitalize="characters"
          aria-invalid={state.error ? true : undefined}
          aria-describedby="table-error"
          className="max-w-32"
        />
        <button type="submit" disabled={pending} className={lineButton}>
          {pending ? "Saving" : "Save"}
        </button>
      </div>
      {state.error && (
        <p id="table-error" className="text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
