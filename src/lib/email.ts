import "server-only";
import { appendFile } from "node:fs/promises";
import { isDeployed } from "@/lib/deployed";

const FROM = process.env.EMAIL_FROM ?? "shoptcg <onboarding@resend.dev>";

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

export async function sendMagicLinkEmail(to: string, url: string) {
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
    // Logging a live sign-in link is only acceptable on a developer machine.
    if (process.env.NODE_ENV === "production")
      throw new Error("RESEND_API_KEY is not set");
    console.log(`[magic-link] ${to}: ${url}`);
    return;
  }
  // Plain fetch to the Resend REST API; the SDK would add a dependency for one call.
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to,
      subject: "Your shoptcg sign-in link",
      text: `Sign in to shoptcg:\n\n${url}\n\nThis link expires in 5 minutes. If you did not ask for it, ignore this email.`,
    }),
  });
  if (!res.ok)
    throw new Error(`Resend failed: ${res.status} ${await res.text()}`);
}

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
