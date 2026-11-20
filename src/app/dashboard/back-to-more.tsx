import { ChevronLeft } from "lucide-react";
import Link from "next/link";

/**
 * "‹ More" on the pages the More menu opens outside its own layout (Ledger,
 * Report, Customers, Preview, Claim events, Sign). They keep their full width,
 * so there is no side list to go back by, on a phone or a desk.
 */
export function BackToMore() {
  return (
    <Link
      href="/dashboard/settings"
      className="-ml-1 inline-flex min-h-11 items-center gap-1 self-start font-semibold"
    >
      <ChevronLeft aria-hidden className="size-5" />
      More
    </Link>
  );
}
