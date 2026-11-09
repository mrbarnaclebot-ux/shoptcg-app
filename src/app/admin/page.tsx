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
import { requireAdmin, sellerTimeZone } from "@/lib/session";
import { CreateInvite } from "./create-invite";
import { RevokeInvite } from "./revoke-invite";

export const metadata: Metadata = {
  title: "Admin - shoptcg",
  robots: { index: false },
};

export default function AdminPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 pt-8 pb-16">
      <h1 className="font-display text-[3.5rem] leading-[0.82] font-black">
        Invites
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
  const [invites, accounts, timeZone] = await Promise.all([
    listInvites(db),
    listAccounts(db),
    sellerTimeZone(),
  ]);
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
      <section aria-labelledby="invites" className="flex w-full flex-col gap-3">
        <h2
          id="invites"
          className="font-display text-[2rem] leading-none font-black"
        >
          Sent
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
              {a.slug ? (
                <Link
                  href={`/${a.slug}`}
                  className="inline-flex min-h-11 items-center self-start text-sm underline underline-offset-4"
                >
                  /{a.slug}
                </Link>
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
