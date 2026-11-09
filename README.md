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

## Catalog and prices

- Search: `searchCatalog()` in `src/lib/catalog.ts` reads the local `catalog_item` cache first, then the provider. With `PPT_API_KEY` set the provider is PokemonPriceTracker; without it, TCGdex (no key, raw EN/JA cards only).
- TCGdex prices are stored under source `tcgdex` for cross-checking only. Their licence is unclear, so they are not for display.
- `pnpm sync:prices` writes today's `price_point` for catalog items searched in the last `SYNC_SEEN_DAYS` (default 30), at most `SYNC_MAX_CALLS` (default 5000) per run. Rerunning the same day overwrites today's rows. It exits non-zero when any item failed to price. PPT allows 60 calls/min per key: the sync runs at 45/min and app search at 15/min (failing fast when busy), so together they stay under the limit. Retries back off on 429, honouring Retry-After up to 60s.
- Each signed-in user may cause 30 provider calls (cache misses) per hour; cache hits and recently empty queries are free.
- Card images are not licensed by any provider. Fine for a hobby project; revisit before a public launch.

## Deploy (Railway)

`railway.json` builds with Railpack, runs `pnpm db:migrate` before each deploy and starts with `pnpm start`. Set `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `RESEND_API_KEY`, `EMAIL_FROM` and `PPT_API_KEY` on the service.

Nightly price sync: add a second service from the same repo with start command `pnpm sync:prices`, cron schedule `0 6 * * *` (06:00 UTC) and restart policy "Never". Give it the same `DATABASE_URL` and `PPT_API_KEY`.
