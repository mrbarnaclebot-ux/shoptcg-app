"use client";

import { Ellipsis, Inbox, LayoutGrid, ReceiptText } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Requests", icon: Inbox },
  { href: "/dashboard/inventory", label: "Inventory", icon: LayoutGrid },
  { href: "/dashboard/sales", label: "Sales", icon: ReceiptText },
  { href: "/dashboard/settings", label: "More", icon: Ellipsis },
];

// Bottom tab bar on phones (thumb reach), left rail from lg up (SCREENS 4).
// The current tab gets a lamp-orange bar under its label, like the tabs sheet.
export function DashboardNav() {
  const path = usePathname();
  const current = (href: string) =>
    href === "/dashboard" ? path === href : path.startsWith(href);
  return (
    <nav
      aria-label="Dashboard"
      className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-24 lg:flex-col lg:gap-1 lg:border-t-0 lg:bg-bg lg:pt-20 lg:pb-0"
    >
      {TABS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={current(href) ? "page" : undefined}
          className="group flex h-16 flex-col items-center justify-center gap-1 text-[0.8125rem] font-medium text-muted-foreground aria-[current=page]:font-bold aria-[current=page]:text-text"
        >
          <Icon aria-hidden className="size-[22px] stroke-[1.75]" />
          <span className="relative pb-1 after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] group-aria-[current=page]:after:bg-brand">
            {label}
          </span>
        </Link>
      ))}
    </nav>
  );
}
