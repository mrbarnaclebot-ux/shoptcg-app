"use client";

import { cn } from "cn";
import {
  BookOpen,
  CalendarClock,
  ChartColumn,
  ChevronLeft,
  ChevronRight,
  CircleUser,
  Eye,
  LifeBuoy,
  type LucideIcon,
  QrCode,
  ShieldCheck,
  ShoppingBag,
  Store,
  Tag,
  BellRing,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SellingMode } from "@/lib/selling-mode";

const HOME = "/dashboard/settings";

type Row = {
  href: string;
  label: string;
  hint: string;
  icon: LucideIcon;
};

// Settings: forms that change how the store works. Each saves on its own.
const SETTINGS: Row[] = [
  {
    href: `${HOME}/store`,
    label: "Store profile",
    icon: Store,
    hint: "Name, link, banner and profile image",
  },
  {
    href: `${HOME}/pricing`,
    label: "Pricing",
    icon: Tag,
    hint: "Price rule, played cards, second currency",
  },
  {
    href: `${HOME}/table`,
    label: "How you sell",
    icon: ShoppingBag,
    hint: "At a table or online, table number, NFC",
  },
  {
    href: `${HOME}/alerts`,
    label: "Alerts",
    icon: BellRing,
    hint: "Chime and locked-phone alerts",
  },
];
// Work: pages you use at and after a show. Full width, with a back link.
const work = (mode: SellingMode): Row[] => [
  {
    href: "/dashboard/reports",
    label: "Report",
    icon: ChartColumn,
    hint: "Takings by day, weekend or month, CSV",
  },
  {
    href: "/dashboard/ledger",
    label: "Ledger",
    icon: BookOpen,
    hint: "Profit, stock value, every stock move, CSV",
  },
  {
    href: "/dashboard/customers",
    label: "Customers",
    icon: Users,
    hint: "Buyers and who takes your emails",
  },
  {
    href: "/dashboard/events",
    label: "Claim events",
    icon: CalendarClock,
    hint:
      mode === "online"
        ? "Timed claim sales on their own page"
        : "For online stores: switch under How you sell",
  },
  ...(mode === "table"
    ? [
        {
          href: "/dashboard/sign",
          label: "Table sign",
          icon: QrCode,
          hint: "Print the QR sign for your table",
        },
      ]
    : []),
  {
    href: "/dashboard/preview",
    label: "Preview store",
    icon: Eye,
    hint: "Your page as buyers see it",
  },
];
const ADMIN: Row = {
  href: "/admin",
  label: "Admin",
  icon: ShieldCheck,
  hint: "Invites, vendors and system checks",
};
const HELP: Row = {
  href: "/help",
  label: "Help",
  icon: LifeBuoy,
  hint: "How everything works",
};
const ACCOUNT: Row = {
  href: `${HOME}/account`,
  label: "Account",
  icon: CircleUser,
  hint: "Sign out, password, email",
};

/**
 * The "More" tab. On a phone it is the whole screen at /dashboard/settings and
 * a back link on the pages under it; from lg up it is a list beside the page.
 */
export function SettingsMenu(props: {
  mode: SellingMode | null;
  admin: boolean;
}) {
  const path = usePathname();
  const home = path === HOME;
  const groups = [
    ...(props.mode
      ? [
          { title: "Settings", rows: SETTINGS },
          { title: "Work", rows: work(props.mode) },
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
        <p aria-hidden className="font-display text-4xl font-black lg:hidden">
          More
        </p>
        {groups.map((g) => (
          <div key={g.title}>
            <p className="pb-1 text-sm text-muted-foreground">{g.title}</p>
            <ul className="border-b border-border">
              {g.rows.map((r) => (
                <li key={r.href} className="border-t border-border">
                  <Link
                    href={r.href}
                    aria-current={path === r.href ? "page" : undefined}
                    className="group grid min-h-14 grid-cols-[1fr_auto] items-center gap-x-3 py-2 hover:bg-surface lg:min-h-11 lg:border-l-[3px] lg:border-transparent lg:px-3 lg:aria-[current=page]:border-brand"
                  >
                    <span className="grid grid-cols-[1.25rem_1fr] items-start gap-x-3 font-semibold lg:items-center lg:font-medium lg:text-muted-foreground lg:group-aria-[current=page]:font-bold lg:group-aria-[current=page]:text-text">
                      <r.icon
                        aria-hidden
                        className="mt-0.5 size-5 stroke-[1.75] text-muted-foreground lg:mt-0"
                      />
                      <span>
                        {r.label}
                        <small className="block text-sm font-normal text-muted-foreground lg:hidden">
                          {r.hint}
                        </small>
                      </span>
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
