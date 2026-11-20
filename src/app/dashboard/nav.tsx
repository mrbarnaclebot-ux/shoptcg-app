"use client";

import { Ellipsis, Inbox, LayoutGrid, ReceiptText } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStoreLive } from "./store-live";

// `also`: pages without a tab of their own light the tab they're opened from.
const TABS = [
  {
    href: "/dashboard",
    label: "Requests",
    icon: Inbox,
    also: ["/dashboard/requests"],
  },
  {
    href: "/dashboard/inventory",
    label: "Inventory",
    icon: LayoutGrid,
    also: ["/dashboard/buy"],
  },
  { href: "/dashboard/sales", label: "Sales", icon: ReceiptText },
  {
    href: "/dashboard/settings",
    // A desk has room for the menu beside a page, so More opens on one.
    desk: "/dashboard/settings/store",
    label: "More",
    icon: Ellipsis,
    also: [
      "/dashboard/customers",
      "/dashboard/preview",
      "/dashboard/events",
      "/dashboard/sign",
      "/dashboard/ledger",
      "/dashboard/reports",
    ],
  },
];

// Bottom tab bar on phones (thumb reach), left rail from lg up (SCREENS 4).
// The current tab gets a lamp-orange bar under its label, like the tabs sheet.
export function DashboardNav() {
  const path = usePathname();
  const { waiting } = useStoreLive();
  const current = (href: string, also: string[] = []) =>
    (href === "/dashboard" ? path === href : path.startsWith(href)) ||
    also.some((a) => path.startsWith(a));
  return (
    <nav
      aria-label="Dashboard"
      data-tab-bar
      className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-24 lg:flex-col lg:gap-1 lg:border-t-0 lg:bg-bg lg:pt-20 lg:pb-0"
    >
      {TABS.flatMap(({ href, desk, label, icon: Icon, also }) => {
        const count = href === "/dashboard" ? waiting : 0;
        // Two links when the desk's differs; CSS shows one, so one is read.
        const links: [string, string][] = desk
          ? [
              [href, "lg:hidden"],
              [desk, "hidden lg:flex"],
            ]
          : [[href, "flex"]];
        return links.map(([to, show]) => (
          <Link
            key={to}
            href={to}
            aria-current={current(href, also) ? "page" : undefined}
            className={`group ${show} h-16 flex-col items-center justify-center gap-1 text-[0.8125rem] font-medium text-muted-foreground aria-[current=page]:font-bold aria-[current=page]:text-text`}
          >
            <span className="relative">
              <Icon aria-hidden className="size-[22px] stroke-[1.75]" />
              {count > 0 && (
                <span
                  aria-hidden
                  className="num absolute -top-2 left-[calc(100%-0.5rem)] min-w-5 bg-brand px-1 text-center text-xs leading-5 text-on-brand"
                >
                  {count}
                </span>
              )}
            </span>
            <span className="relative pb-1 after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] group-aria-[current=page]:after:bg-brand">
              {label}
              {/* Read as "Requests (2 waiting)"; an aria-label would hide the
                  visible label from voice control. */}
              {count > 0 && <span className="sr-only">({count} waiting)</span>}
            </span>
          </Link>
        ));
      })}
    </nav>
  );
}
