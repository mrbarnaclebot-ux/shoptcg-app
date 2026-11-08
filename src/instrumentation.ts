import { z } from "zod";

const envSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.url(),
  RESEND_API_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
});

// Runs once at server start. A misconfigured deploy should crash, not limp along.
export function register() {
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success)
    throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
}
