import { cn } from "cn";
import Link from "next/link";
import { SellerLink } from "./seller-link";
import { Wordmark } from "./wordmark";

const quiet =
  "inline-flex min-h-11 items-center underline-offset-4 hover:underline";

/** Top of every public page: the wordmark and the way in for sellers. */
export function PublicHeader(props: {
  className?: string;
  /** Off on pages that are already the way in (sign in, welcome). */
  signIn?: boolean;
}) {
  return (
    <header
      className={cn(
        "flex items-center justify-between gap-4 px-4 py-2 md:px-14 md:py-6",
        props.className,
      )}
    >
      <Wordmark />
      {props.signIn !== false && (
        <SellerLink className="inline-flex min-h-11 items-center text-md font-medium underline decoration-[oklch(1_0_0/0.35)] decoration-[1.5px] underline-offset-[6px] transition-[text-decoration-color] duration-200 hover:decoration-brand" />
      )}
    </header>
  );
}

/** Bottom of every public page, on the hall. */
export function PublicFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "mx-auto flex w-full max-w-[1440px] flex-wrap gap-x-7 gap-y-1 px-4 pt-5 pb-8 text-[0.84rem] text-muted-foreground md:px-14",
        className,
      )}
    >
      <Link href="/help" className={quiet}>
        Help
      </Link>
      <Link href="/terms" className={quiet}>
        Terms
      </Link>
      <p className="self-center md:ml-auto">
        Not affiliated with Nintendo, Creatures, GAME FREAK or The Pokemon
        Company.
      </p>
    </footer>
  );
}
