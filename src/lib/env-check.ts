import { z } from "zod";
import { isDeployed } from "@/lib/deployed";

type Env = Record<string, string | undefined>;

const VAPID = ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"];
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
  if (!env.PPT_API_KEY)
    warnings.push("PPT_API_KEY unset: catalog search falls back to TCGdex");
  if (isDeployed(env))
    for (const k of TEST_ONLY)
      if (env[k]) errors.push(`${k} must never be set on a deployed service`);
  return { errors, warnings };
}
