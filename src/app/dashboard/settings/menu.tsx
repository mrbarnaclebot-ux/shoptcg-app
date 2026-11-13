"use client";

import { cn } from "cn";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const HOME = "/dashboard/settings";

type Row = { href: string; label: string; hint: string; wide?: true };

const STORE: Row[] = [
  {
    href: "/dashboard/preview",
    label: "Preview store",
    hint: "Your page as buyers see it",
  },
  {
    href: `${HOME}/store`,
    label: "Store profile",
    hint: "Name, banner and profile image",
  },
  {
    href: `${HOME}/pricing`,
    label: "Pricing",
    hint: "Price rule, rounding, second currency",
  },
  {
    href: `${HOME}/table`,
    label: "How you sell",
    hint: "At a table or online, table number, sign",
  },
  {
    href: `${HOME}/alerts`,
    label: "Alerts",
    hint: "Sound and locked-phone alerts",
  },
];
const RECORDS: Row[] = [
  {
    href: "/dashboard/ledger",
    label: "Ledger",
    hint: "Profit, stock value, stock in and out",
  },
  {
    href: "/dashboard/customers",
    label: "Customers",
    hint: "Buyers and who takes your emails",
  },
  {
    href: "/dashboard/reports",
    label: "Sales report",
    hint: "Totals by day or weekend, CSV export",
  },
];
const ADMIN: Row = {
  href: "/admin",
  label: "Admin",
  hint: "Invites, vendors and system checks",
};
const HELP: Row = {
  href: "/help",
  label: "Help",
  hint: "How everything works",
};
// On a phone the account block sits under the menu, so the row is desktop only.
const ACCOUNT: Row = {
  href: HOME,
  label: "Account",
  hint: "Sign out",
  wide: true,
};

/**
 * The "More" tab. On a phone it is the whole screen at /dashboard/settings and
 * a back link on the pages under it; from lg up it is a list beside the page.
 */
export function SettingsMenu(props: { hasStore: boolean; admin: boolean }) {
  const path = usePathname();
  const home = path === HOME;
  const groups = [
    ...(props.hasStore
      ? [
          { title: "Your store", rows: STORE },
          { title: "Records", rows: RECORDS },
        ]
      : []),
    { title: "You", rows: [HELP, ...(props.admin ? [ADMIN] : []), ACCOUNT] },
  ];
  return (
    <nav aria-label="Settings" className="lg:sticky lg:top-8 lg:self-start">
      {!home && (
        <Link
          href={HOME}
          className="-ml-1 inline-flex min-h-11 items-center gap-1 font-semibold lg:hidden"
        >
          <ChevronLeft aria-hidden className="size-5" />
          More
        </Link>
      )}
      <div className={cn("flex-col gap-6", home ? "flex" : "hidden lg:flex")}>
        <p
          aria-hidden
          className="font-display text-[3.5rem] leading-[0.82] font-black lg:hidden"
        >
          More
        </p>
        {groups.map((g) => (
          <div
            key={g.title}
            className={cn(g.rows.every((r) => r.wide) && "hidden lg:block")}
          >
            <p className="pb-1 text-sm text-muted-foreground">{g.title}</p>
            <ul className="border-b border-border">
              {g.rows.map((r) => (
                <li
                  key={r.href}
                  className={cn(
                    "border-t border-border",
                    r.wide && "hidden lg:block",
                  )}
                >
                  <Link
                    href={r.href}
                    aria-current={path === r.href ? "page" : undefined}
                    className="group grid min-h-14 grid-cols-[1fr_auto] items-center gap-x-3 py-2 hover:bg-surface lg:min-h-11 lg:border-l-[3px] lg:border-transparent lg:px-3 lg:aria-[current=page]:border-brand"
                  >
                    <span className="font-semibold lg:font-medium lg:text-muted-foreground lg:group-aria-[current=page]:font-bold lg:group-aria-[current=page]:text-text">
                      {r.label}
                      <small className="block text-sm font-normal text-muted-foreground lg:hidden">
                        {r.hint}
                      </small>
                    </span>
                    <ChevronRight
                      aria-hidden
                      className="size-5 text-muted-foreground lg:hidden"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
