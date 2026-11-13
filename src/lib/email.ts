import "server-only";
import { appendFile } from "node:fs/promises";
import { isDeployed } from "@/lib/deployed";

const FROM = process.env.EMAIL_FROM ?? "tcgmart <onboarding@resend.dev>";

/**
 * E2E only: playwright.config.ts sets MAGIC_LINK_OUTBOX so tests read sign-in
 * links from a file. On a deployed service that would let anyone with file
 * access sign in as anyone, so refuse to start instead of ignoring it.
 */
export function outboxPath(env: Record<string, string | undefined>) {
  const outbox = env.MAGIC_LINK_OUTBOX;
  if (outbox && isDeployed(env))
    throw new Error(
      "MAGIC_LINK_OUTBOX must never be set on a deployed service",
    );
  return outbox || null;
}

const OUTBOX = outboxPath(process.env);

/**
 * Account email: invites, password resets and the admin's request alert.
 * e2e writes "<to> <url>" lines to the outbox instead.
 */
async function sendAccountEmail(
  to: string,
  url: string,
  subject: string,
  text: string,
) {
  if (OUTBOX) {
    await appendFile(
      OUTBOX,
      `${to} ${url}
`,
    );
    return;
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Logging a live link is only acceptable on a developer machine.
    if (process.env.NODE_ENV === "production")
      throw new Error("RESEND_API_KEY is not set");
    console.log(`[account-email] ${to}: ${url}`);
    return;
  }
  // Plain fetch to the Resend REST API; the SDK would add a dependency for one call.
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to, subject, text }),
  });
  if (!res.ok)
    throw new Error(`Resend failed: ${res.status} ${await res.text()}`);
}

export const sendInviteEmail = (to: string, url: string) =>
  sendAccountEmail(
    to,
    url,
    "Set up your tcgmart account",
    `You're invited to sell on tcgmart. Open this link to set up your account and choose a password:

${url}

It works once and expires in 48 hours. If it expires, enter your invite code again at ${new URL("/join", url).origin}/join. If you weren't expecting this, ignore this email.`,
  );

export const sendResetEmail = (to: string, url: string) =>
  sendAccountEmail(
    to,
    url,
    "Set your tcgmart password",
    `Use this link to set a new password for tcgmart:

${url}

It works once and expires in 1 hour. If you didn't ask for it, ignore this email; your password hasn't changed.`,
  );

/** Tells the admins someone asked for an invite; the request waits on /admin. */
export const sendInviteRequestAlert = (to: string, url: string, who: string) =>
  sendAccountEmail(
    to,
    url,
    "New invite request on tcgmart",
    `${who} asked for an invite.

Review it on the admin page:

${url}`,
  );

export type ReceiptMail = {
  to: string;
  receiptNo: string;
  unsubscribeUrl: string | null;
  message: { subject: string; html: string; text: string };
};

/** Throws on failure; the caller records it so the seller can resend. */
export async function sendReceiptEmail(mail: ReceiptMail) {
  if (OUTBOX) {
    await appendFile(
      OUTBOX,
      `${mail.to} receipt:${mail.receiptNo} ${mail.unsubscribeUrl ?? "-"}\n`,
    );
    return;
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: mail.to,
      ...mail.message,
      // RFC 8058: mail clients POST here without opening the page.
      ...(mail.unsubscribeUrl && {
        headers: {
          "List-Unsubscribe": `<${mail.unsubscribeUrl.replace("/u/", "/api/unsubscribe?t=")}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    }),
  });
  if (!res.ok)
    throw new Error(`Resend failed: ${res.status} ${await res.text()}`);
}
