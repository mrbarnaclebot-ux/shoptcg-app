import { z } from "zod";
import { isDeployed } from "@/lib/deployed";

type Env = Record<string, string | undefined>;

const VAPID = ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"];
const PINATA = ["PINATA_JWT", "PINATA_GATEWAY_URL"];
const TURNSTILE = ["TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"];
// Test hooks: sign-in links written to a file, and the routes that mint invites and stock.
const TEST_ONLY = ["MAGIC_LINK_OUTBOX", "E2E_SEED"];

const schema = z.object({
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.url(),
  RESEND_API_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
});

/**
 * What a production server needs before it takes traffic. Errors stop the
 * boot; warnings are features that are quietly off.
 */
export function checkEnv(env: Env) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const parsed = schema.safeParse(env);
  if (!parsed.success) errors.push(z.prettifyError(parsed.error));
  const vapid = VAPID.filter((k) => env[k]);
  if (vapid.length && vapid.length < VAPID.length)
    errors.push(`Set all of ${VAPID.join(", ")} or none`);
  if (!vapid.length) warnings.push("VAPID keys unset: push alerts are off");
  const pinata = PINATA.filter((k) => env[k]);
  if (pinata.length === 1) errors.push(`Set both of ${PINATA.join(", ")}`);
  if (!pinata.length)
    warnings.push("Pinata unset: store image uploads are off");
  const turnstile = TURNSTILE.filter((k) => env[k]);
  if (turnstile.length === 1)
    errors.push(`Set both of ${TURNSTILE.join(", ")}`);
  if (!turnstile.length)
    warnings.push("Turnstile unset: buyers can't join claim events");
  if (!env.EMAIL_FROM || /@resend[.]dev>?$/i.test(env.EMAIL_FROM.trim()))
    warnings.push(
      "EMAIL_FROM unset or Resend's test sender: mail only reaches the Resend account owner",
    );
  const canonical = env.CANONICAL_HOST?.trim().toLowerCase();
  if (canonical && parsed.success) {
    const host = new URL(env.BETTER_AUTH_URL!).host;
    // Redirecting every visit away from the host sign-in links point at loops.
    if (host !== canonical)
      errors.push(
        `CANONICAL_HOST is ${canonical} but BETTER_AUTH_URL is ${host}`,
      );
  }
  if (!env.PPT_API_KEY)
    warnings.push("PPT_API_KEY unset: catalog search falls back to TCGdex");
  if (isDeployed(env))
    for (const k of TEST_ONLY)
      if (env[k]) errors.push(`${k} must never be set on a deployed service`);
  return { errors, warnings };
}
