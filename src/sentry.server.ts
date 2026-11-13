import * as Sentry from "@sentry/nextjs";

// Off until SENTRY_DSN is set (local, CI and e2e never send). The app already
// logs every swallowed failure with console.error and no personal data, so
// those lines become Sentry events too.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  environment: process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.NODE_ENV,
  release: process.env.RAILWAY_GIT_COMMIT_SHA,
  tracesSampleRate: 0.1,
  integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],
});
