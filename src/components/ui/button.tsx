import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

// Show floor buttons: square-cut, no pills. `default` is the notched lamp
// ticket (without a stub; TicketButton adds one for the screen's main action),
// `outline`/`secondary` are a cut line in the current text colour.
const variants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 font-semibold whitespace-nowrap transition-colors outline-none select-none active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "btn-ticket",
        outline:
          "shadow-[inset_0_0_0_1.5px_currentColor] hover:bg-[color-mix(in_oklch,currentColor_8%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus",
        secondary:
          "shadow-[inset_0_0_0_1.5px_currentColor] hover:bg-[color-mix(in_oklch,currentColor_8%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus",
        ghost:
          "hover:bg-[color-mix(in_oklch,currentColor_8%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus",
        destructive:
          "text-danger shadow-[inset_0_0_0_1.5px_currentColor] hover:bg-[color-mix(in_oklch,currentColor_8%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus",
        link: "underline decoration-brand decoration-[1.5px] underline-offset-[5px] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus",
      },
      size: {
        default: "h-10 px-4 text-sm",
        xs: "h-7 px-2 text-xs",
        sm: "h-9 px-3 text-sm",
        lg: "h-12 px-5 text-base",
        icon: "size-10",
        "icon-xs": "size-7",
        "icon-sm": "size-9",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

// Merged so Link callers get the same conflict resolution as <Button>.
function buttonVariants(...args: Parameters<typeof variants>) {
  return cn(variants(...args));
}

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof variants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
