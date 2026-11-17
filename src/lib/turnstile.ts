import "server-only";
import { isDeployed } from "@/lib/deployed";

// Cloudflare Turnstile: one bot check when a buyer joins a claim event.
const VERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type Env = Record<string, string | undefined>;

/** The public key the widget needs, or null when the check is off. */
export const turnstileSiteKey = (env: Env = process.env) =>
  env.TURNSTILE_SITE_KEY || null;

/**
 * Whether the widget's token is a pass. With no keys, local runs and e2e pass,
 * and a deployed server refuses every join (the boot check warns).
 */
export async function humanCheck(
  token: string,
  ip: string | null,
  env: Env = process.env,
) {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) return !isDeployed(env);
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch(VERIFY, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
    });
    return ((await res.json()) as { success?: boolean }).success === true;
  } catch (err) {
    console.error("[turnstile] verify failed", err);
    return false;
  }
}
