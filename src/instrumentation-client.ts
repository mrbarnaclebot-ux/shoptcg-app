import * as Sentry from "@sentry/nextjs";

// Browser errors only, no tracing or replay, to keep the buyer's bundle small.
// next.config.ts passes the server's SENTRY_DSN in at build time.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NEXT_PUBLIC_SENTRY_ENV,
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
});
