import { headingIcon } from "@/components/bento";
import { Activity, MailQuestion, Search, Ticket, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BackToMore } from "@/app/dashboard/back-to-more";
import {
  bentoColumn,
  bentoLeft,
  bentoPage,
  bentoRight,
} from "@/components/bento";
import { Ticket as TicketBox, TicketLoading } from "@/components/ticket";
import { lineButton } from "@/components/ticket-button";
import { getDb } from "@/db";
import {
  canRevoke,
  SHOWN,
  inviteStatus,
  listAccounts,
  listInvites,
  openInviteRequests,
} from "@/lib/invites";
import { checkEnv } from "@/lib/env-check";
import { requireAdmin, sellerTimeZone } from "@/lib/session";
import { lastPriceDate } from "@/lib/sync-prices";
import { AnswerRequest } from "./answer-request";
import { CreateInvite } from "./create-invite";
import { RevokeInvite } from "./revoke-invite";
import { VendorControls } from "./vendor-controls";

const LIVE = { open: "Open", paused: "Paused", off: "Not vending" } as const;

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false },
};

type Search = Pick<PageProps<"/admin">, "searchParams">;

export default function AdminPage({ searchParams }: Search) {
  return (
    // Desktop: invites and system on the left, the long accounts list beside.
    <main
      className={`mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 pt-8 pb-16 lg:max-w-[1280px] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:px-8 ${bentoPage}`}
    >
      <div className="lg:col-span-2">
        <BackToMore />
      </div>
      <h1 className="font-display text-4xl font-black lg:col-span-2 lg:mb-8">
        Admin
      </h1>
      <Suspense fallback={<TicketLoading>Checking who you are</TicketLoading>}>
        <Admin searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Admin({ searchParams }: Search) {
  await requireAdmin();
  const { q: raw } = await searchParams;
  const q = typeof raw === "string" ? raw.trim().slice(0, 100) : "";
  const db = getDb();
  const [requests, invites, accounts, timeZone, priced] = await Promise.all([
    openInviteRequests(db),
    listInvites(db),
    listAccounts(db, q || undefined),
    sellerTimeZone(),
    lastPriceDate(db),
  ]);
  const { warnings } = checkEnv(process.env);
  const day = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  });
  const now = new Date();
  return (
    <>
      <div className={`${bentoColumn} ${bentoLeft}`}>
        <div>
          <TicketBox as="div" className="w-full [--stub:2rem]">
            <CreateInvite />
          </TicketBox>
        </div>
        <section
          aria-labelledby="requests"
          className="flex w-full flex-col gap-3"
        >
          <h2
            id="requests"
            className="font-display text-[2rem] leading-none font-black"
          >
            <MailQuestion aria-hidden className={headingIcon} />
            Invite requests
          </h2>
          {requests.length === 0 ? (
            <p className="text-muted-foreground">No one is waiting.</p>
          ) : (
            <ul className="divide-y divide-border border-y border-border">
              {requests.map((r) => (
                <li key={r.id} className="flex flex-col gap-1 py-3">
                  <p className="font-semibold [overflow-wrap:anywhere]">
                    {r.name}, {r.email}
                  </p>
                  {r.about && (
                    <p className="[overflow-wrap:anywhere] whitespace-pre-line">
                      {r.about}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Asked {day.format(r.createdAt)}.
                  </p>
                  <AnswerRequest id={r.id} name={r.name} />
                </li>
              ))}
            </ul>
          )}
        </section>
        <section
          aria-labelledby="system"
          className="flex w-full flex-col gap-3"
        >
          <h2
            id="system"
            className="font-display text-[2rem] leading-none font-black"
          >
            <Activity aria-hidden className={headingIcon} />
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
        <section
          aria-labelledby="invites"
          className="flex w-full flex-col gap-3"
        >
          <h2
            id="invites"
            className="font-display text-[2rem] leading-none font-black"
          >
            <Ticket aria-hidden className={headingIcon} />
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
                    {day.format(i.createdAt)}. Expires {day.format(i.expiresAt)}
                    .
                  </p>
                  {canRevoke(i, now) && <RevokeInvite id={i.id} />}
                </li>
              ))}
            </ul>
          )}
          {invites.length === SHOWN && <Capped />}
        </section>
      </div>
      <div className={`${bentoColumn} ${bentoRight}`}>
        <section
          aria-labelledby="accounts"
          className="flex w-full flex-col gap-3"
        >
          <h2
            id="accounts"
            className="font-display text-[2rem] leading-none font-black"
          >
            <Users aria-hidden className={headingIcon} />
            Accounts
          </h2>
          <form action="/admin" role="search" className="flex w-full gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Search accounts</span>
              <input
                type="search"
                name="q"
                defaultValue={q}
                maxLength={100}
                placeholder="Email, store name or link"
                className="h-12 w-full border border-border-strong bg-transparent px-3 text-base"
              />
            </label>
            <button type="submit" className={lineButton}>
              <Search aria-hidden className="size-5" />
              Search
            </button>
          </form>
          {q && accounts.length === 0 && (
            <p className="text-muted-foreground">
              No account matches that.{" "}
              <Link href="/admin" className="font-semibold underline">
                Show everyone
              </Link>
            </p>
          )}
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
      </div>
    </>
  );
}

function Capped() {
  return (
    <p className="text-sm text-muted-foreground">Showing the newest {SHOWN}.</p>
  );
}
