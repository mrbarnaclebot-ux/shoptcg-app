import * as Sentry from "@sentry/nextjs";
import { checkEnv } from "@/lib/env-check";

// Runs once at server start. A misconfigured deploy should crash, not limp along.
export async function register() {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./sentry.server");
  if (process.env.NODE_ENV === "production") {
    const { errors, warnings } = checkEnv(process.env);
    for (const w of warnings) console.warn(`[env] ${w}`);
    if (errors.length)
      throw new Error(`Invalid environment:\n${errors.join("\n")}`);
  }
  // Holds already read as expired lazily; the sweeper only tells open screens
  // sooner. Railway cron can't run more often than every 5 minutes.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const [{ sharedDb }, { startSweeper }] = await Promise.all([
      import("./db/open"),
      import("./lib/request-sweep"),
    ]);
    startSweeper(sharedDb());
  }
}

// Server Component, route handler and server action errors Next catches itself.
export const onRequestError = Sentry.captureRequestError;
