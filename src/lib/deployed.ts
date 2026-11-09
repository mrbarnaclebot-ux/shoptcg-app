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
