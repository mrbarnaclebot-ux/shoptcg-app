import { headingIcon } from "@/components/bento";
import { and, count, eq } from "drizzle-orm";
import { Check, ListChecks } from "lucide-react";
import Link from "next/link";
import { getDb } from "@/db";
import { listing } from "@/db/schema";
import type { getStoreByOwner } from "@/lib/stores";
import { dismissTipsAction } from "./actions";

type Store = NonNullable<Awaited<ReturnType<typeof getStoreByOwner>>>;

/**
 * First-run tips on the dashboard. Ticks come from what the store already has;
 * "Hide tips" stores tips_dismissed_at so they never show again. /help keeps
 * the long version for later.
 */
export async function GettingStarted({ store }: { store: Store }) {
  const [{ n }] = await getDb()
    .select({ n: count() })
    .from(listing)
    .where(and(eq(listing.storeId, store.id), eq(listing.active, true)));
  const online = store.sellingMode === "online";
  const steps = [
    {
      title: "Add your stock",
      body: "Search the catalog by name, set or number, or import a CSV. Prices fill in from the market.",
      href: "/dashboard/inventory/add",
      done: n > 0,
    },
    {
      title: "Choose how you sell",
      body: "At a show table or as an online store. It changes what buyers read and how long carts are held.",
      href: "/dashboard/settings/table",
      done: online || !!store.tableLabel,
    },
    {
      title: "Set your price rule",
      body: "Sell at market, or a percentage of it, with rounding.",
      href: "/dashboard/settings/pricing",
      done: store.priceRulePct !== 0 || Number(store.rounding) > 0,
    },
    {
      title: "Add a banner or profile image",
      body: "Buyers see it at the top of your store.",
      href: "/dashboard/settings/store",
      done: !!(store.bannerUrl || store.avatarUrl),
    },
    {
      title: "Turn on alerts",
      body: "A chime and a locked-phone alert the moment a cart comes in.",
      href: "/dashboard/settings/alerts",
      done: false,
    },
    {
      title: online ? "Share your link" : "Print your table sign",
      body: online
        ? "Post your store link on socials, in groups and in DMs."
        : "A QR sign for the table. Buyers scan it and shop from their phone.",
      href: online ? "/dashboard/settings/store" : "/dashboard/sign",
      done: false,
    },
    {
      title: "Open your store",
      body: "Use the switch above. Buyers can send carts only while you're open.",
      href: null,
      done: !!store.openedAt,
    },
  ];
  const left = steps.filter((s) => !s.done).length;
  return (
    <section
      aria-labelledby="tips-title"
      className="flex flex-col gap-4 px-5 py-5 shadow-[inset_0_0_0_1.5px_var(--border-strong)] lg:p-0 lg:shadow-none"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="tips-title"
          className="font-display text-[2rem] leading-none font-black"
        >
          <ListChecks aria-hidden className={headingIcon} />
          Getting started
        </h2>
        <p className="text-sm text-muted-foreground">
          {left ? (
            <>
              <span className="num">{left}</span> of{" "}
              <span className="num">{steps.length}</span> left.
            </>
          ) : (
            "All set."
          )}{" "}
          The full guide is in{" "}
          <Link
            href="/help"
            className="font-semibold text-text underline decoration-brand decoration-[1.5px] underline-offset-[5px]"
          >
            Help
          </Link>
          .
        </p>
      </div>
      <ol className="flex flex-col border-b border-border">
        {steps.map((s, i) => {
          const label = (
            <span className="flex flex-col">
              <span className="font-semibold">
                {s.title}
                {s.done && <span className="sr-only"> (done)</span>}
              </span>
              <span className="text-sm text-muted-foreground">{s.body}</span>
            </span>
          );
          return (
            <li
              key={s.title}
              className="grid grid-cols-[1.75rem_1fr] items-start gap-x-3 border-t border-border py-3"
            >
              <span
                aria-hidden
                className={
                  s.done
                    ? "num flex size-7 items-center justify-center bg-brand text-bg"
                    : "num flex size-7 items-center justify-center text-sm shadow-[inset_0_0_0_1.5px_var(--border-strong)]"
                }
              >
                {s.done ? <Check className="size-4 stroke-[2.5]" /> : i + 1}
              </span>
              {s.href ? (
                <Link href={s.href} className="hover:underline">
                  {label}
                </Link>
              ) : (
                label
              )}
            </li>
          );
        })}
      </ol>
      <form action={dismissTipsAction}>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center text-sm font-semibold underline decoration-brand decoration-[1.5px] underline-offset-[5px]"
        >
          Hide tips
        </button>
      </form>
    </section>
  );
}
