import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Ticket, TicketLoading } from "@/components/ticket";
import { lineButton } from "@/components/ticket-button";
import { getDb } from "@/db";
import {
  canRevoke,
  SHOWN,
  inviteStatus,
  listAccounts,
  listInvites,
} from "@/lib/invites";
import { checkEnv } from "@/lib/env-check";
import { requireAdmin, sellerTimeZone } from "@/lib/session";
import { lastPriceDate } from "@/lib/sync-prices";
import { CreateInvite } from "./create-invite";
import { RevokeInvite } from "./revoke-invite";
import { VendorControls } from "./vendor-controls";

const LIVE = { open: "Open", paused: "Paused", off: "Not vending" } as const;

export const metadata: Metadata = {
  title: "Admin - shoptcg",
  robots: { index: false },
};

export default function AdminPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 pt-8 pb-16">
      <h1 className="font-display text-[3.5rem] leading-[0.82] font-black">
        Admin
      </h1>
      <Suspense fallback={<TicketLoading>Checking who you are</TicketLoading>}>
        <Admin />
      </Suspense>
    </main>
  );
}

async function Admin() {
  await requireAdmin();
  const db = getDb();
  const [invites, accounts, timeZone, priced] = await Promise.all([
    listInvites(db),
    listAccounts(db),
    sellerTimeZone(),
    lastPriceDate(db),
  ]);
  const { warnings } = checkEnv(process.env);
  if (!process.env.EMAIL_FROM)
    warnings.push(
      "EMAIL_FROM unset: mail goes out from Resend's test address and only reaches the Resend account owner",
    );
  const day = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  });
  const now = new Date();
  return (
    <>
      <Ticket as="div" className="w-full [--stub:2rem]">
        <CreateInvite />
      </Ticket>
      <section aria-labelledby="system" className="flex w-full flex-col gap-3">
        <h2
          id="system"
          className="font-display text-[2rem] leading-none font-black"
        >
          System
        </h2>
        <ul className="divide-y divide-border border-y border-border">
          <li className="py-3">
            {priced
              ? `Card prices last updated ${priced}.`
              : "No card prices stored yet."}
          </li>
          {warnings.map((w) => (
            <li key={w} className="py-3 [overflow-wrap:anywhere]">
              {w}.
            </li>
          ))}
          {warnings.length === 0 && (
            <li className="py-3">
              Mail, push alerts, image uploads and paid prices are all set up.
            </li>
          )}
        </ul>
      </section>
      <section aria-labelledby="invites" className="flex w-full flex-col gap-3">
        <h2
          id="invites"
          className="font-display text-[2rem] leading-none font-black"
        >
          Invites sent
        </h2>
        {invites.length === 0 ? (
          <p className="text-muted-foreground">No invites yet.</p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {invites.map((i) => (
              <li
                key={i.id}
                data-invite={i.id}
                className="flex flex-col gap-1 py-3"
              >
                <p className="font-semibold [overflow-wrap:anywhere]">
                  {inviteStatus(i, now)}
                </p>
                <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
                  {i.label ? `${i.label}. ` : ""}Created{" "}
                  {day.format(i.createdAt)}. Expires {day.format(i.expiresAt)}.
                </p>
                {canRevoke(i, now) && <RevokeInvite id={i.id} />}
              </li>
            ))}
          </ul>
        )}
        {invites.length === SHOWN && <Capped />}
      </section>
      <section
        aria-labelledby="accounts"
        className="flex w-full flex-col gap-3"
      >
        <h2
          id="accounts"
          className="font-display text-[2rem] leading-none font-black"
        >
          Accounts
        </h2>
        <ul className="divide-y divide-border border-y border-border">
          {accounts.map((a) => (
            <li key={a.id} className="flex flex-col gap-1 py-3">
              <p className="font-semibold [overflow-wrap:anywhere]">
                {a.email}
              </p>
              <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
                Joined {day.format(a.joined)}.{" "}
                {a.invited
                  ? `Invited${a.invite ? `: ${a.invite}` : ""}.`
                  : "No invite."}
              </p>
              {a.slug && a.storeId ? (
                <>
                  <p className="text-sm [overflow-wrap:anywhere]">
                    <Link
                      href={`/${a.slug}`}
                      className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
                    >
                      {a.storeName}
                    </Link>{" "}
                    <span className="text-muted-foreground">
                      /{a.slug}.{" "}
                      {a.suspended ? "Stopped by admin" : LIVE[a.live]}.{" "}
                      {a.inStock} in stock.{" "}
                      {a.lastSale
                        ? `Last sale ${day.format(a.lastSale)}.`
                        : "No sales yet."}
                    </span>
                  </p>
                  <VendorControls
                    storeId={a.storeId}
                    name={a.storeName ?? a.slug}
                    suspended={a.suspended}
                    hasImages={a.hasImages}
                  />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No store.</p>
              )}
            </li>
          ))}
        </ul>
        {accounts.length === SHOWN && <Capped />}
      </section>
      <Link href="/dashboard" className={`${lineButton} self-start`}>
        Back to dashboard
      </Link>
    </>
  );
}

function Capped() {
  return (
    <p className="text-sm text-muted-foreground">Showing the newest {SHOWN}.</p>
  );
}
