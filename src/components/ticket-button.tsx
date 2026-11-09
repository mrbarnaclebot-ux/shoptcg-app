import { cn } from "cn";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

// Secondary is a cut-line outline in the current text colour, so it reads on
// either material without a variant per surface.
export const lineButton =
  "inline-flex min-h-12 items-center justify-center gap-2 px-5 font-semibold whitespace-nowrap shadow-[inset_0_0_0_1.5px_currentColor] transition-colors hover:bg-[color-mix(in_oklch,currentColor_8%,transparent)] disabled:cursor-not-allowed disabled:opacity-45";

type Common = {
  variant?: "primary" | "secondary";
  /** Stub icon; defaults to an arrow. Primary only. */
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
};

function Inner({ icon, children }: Pick<Common, "icon" | "children">) {
  return (
    <>
      <span className="btn-ticket-main">{children}</span>
      <span aria-hidden className="btn-ticket-stub">
        {icon ?? <ArrowRight className="size-[18px]" strokeWidth={2.2} />}
      </span>
    </>
  );
}

/**
 * The one primary action on a screen: a lamp-orange ticket with notches and
 * a perforated stub. With `href` it renders a Link.
 */
export function TicketButton(
  props: Common &
    (
      | ({ href: string } & Omit<ComponentProps<typeof Link>, "className">)
      | ({ href?: undefined } & Omit<ComponentProps<"button">, "className">)
    ),
) {
  const { variant = "primary", icon, className, children, ...rest } = props;
  const cls = cn(variant === "primary" ? "btn-ticket" : lineButton, className);
  const inner =
    variant === "primary" ? <Inner icon={icon}>{children}</Inner> : children;
  if (rest.href !== undefined)
    return (
      <Link {...(rest as ComponentProps<typeof Link>)} className={cls}>
        {inner}
      </Link>
    );
  return (
    <button
      type="button"
      {...(rest as ComponentProps<"button">)}
      className={cls}
    >
      {inner}
    </button>
  );
}
