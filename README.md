# shoptcg.app

Live-priced Pokemon TCG stock for card show vendors. Spec: `.planning/PROJECT.md`.

## Setup

```sh
scripts/setup.sh
```

Installs dependencies, creates `.env` from `.env.example`, migrates the local database and installs the Playwright browser. Needs Node 22+ and pnpm. No Postgres or Docker needed: without `DATABASE_URL` the app uses an embedded PGlite database at `.data/pglite`.

## Develop

```sh
scripts/dev.sh
```

Open http://localhost:3000/login. Without `RESEND_API_KEY`, the magic link is printed to the dev server console. Stop the dev server before running `pnpm db:migrate` by hand: PGlite allows one process at a time.

## Test

```sh
scripts/test.sh
```

Runs lint, typecheck, Vitest, build and the Playwright smoke test, the same as CI.

## Database

- Schema: `src/db/schema.ts`. After changing it run `pnpm db:generate` and commit the new file in `drizzle/`.
- `pnpm db:migrate` applies migrations to `DATABASE_URL`, or to PGlite when unset.

## Deploy (Railway)

`railway.json` builds with Railpack, runs `pnpm db:migrate` before each deploy and starts with `pnpm start`. Set `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `RESEND_API_KEY` and `EMAIL_FROM` on the service.
