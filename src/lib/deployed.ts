type Env = Record<string, string | undefined>;

// Railway sets these on every deployed service, at build and at runtime.
// NODE_ENV is not enough: e2e and local `pnpm start` also run production builds.
const RAILWAY = [
  "RAILWAY_ENVIRONMENT",
  "RAILWAY_ENVIRONMENT_ID",
  "RAILWAY_PROJECT_ID",
];

/** True on a deployed service. No "server-only": drizzle.config.ts imports it too. */
export function isDeployed(env: Env = process.env) {
  return RAILWAY.some((k) => Boolean(env[k]));
}

/**
 * The public origin, from BETTER_AUTH_URL (never from request headers, which
 * the client controls). Falls back to localhost only in development, so a
 * printed QR can never silently point at localhost.
 */
export function appUrl(env: Env = process.env): URL {
  const url = env.BETTER_AUTH_URL;
  if (url) return new URL(url);
  if (isDeployed(env) || env.NODE_ENV === "production")
    throw new Error("BETTER_AUTH_URL is required");
  return new URL("http://localhost:3000");
}
