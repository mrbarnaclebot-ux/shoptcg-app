import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "cn";

// Square field with a cut-line border in the material's strong border colour;
// focus thickens it in the lamp colour (sun-ink on paper, via --focus).
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-12 w-full min-w-0 bg-bg px-3.5 py-1 text-base text-text shadow-[inset_0_0_0_1.5px_var(--border-strong)] transition-shadow outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-subtle focus-visible:shadow-[inset_0_0_0_2.5px_var(--focus)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 aria-invalid:shadow-[inset_0_0_0_2px_var(--danger)]",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
