# Handoff

Read this first. Update it at the end of every phase, merge or deploy, in the same PR as the work.

_Last updated: 2026-11-10. `main` and `production` are level; the last code change is `ee5a100` (PR #16)._

## Where things stand

- **Live:** production https://web-production-2d3b0.up.railway.app and staging https://web-staging-staging-6b4e.up.railway.app both run the phase 8 build. CI is green and `pnpm smoke <url>` passes on both.
- **Shipped:** all eight phases, plus:
  - the CI pipeline
  - the known-gap fixes (PR #11)
  - vendor invites (PR #12)
  - the three store states (PR #13)
  - migration `0016`, which dropped `stores.is_open` (PR #15)
- **Phase 8 (PR #16):** `e2e/run-a-show.spec.ts` takes one vendor through a whole show at phone, tablet and desktop size, with an accessibility scan on each screen. Differences from the plan are under "As built" in `.planning/phases/08-e2e/PLAN.md`.
- **Prices:** production runs on the PPT Pro plan ($9.99/mo, 20,000 credits a day), the owner's decision on 2026-11-10. `PPT_API_KEY` is set on `web` and on the new `price-sync` cron service, which runs `pnpm sync:prices` at 02:00 UTC. A manual run on 2026-11-10 connected and finished with 0 items, because no store has stock yet.
- **Invites:** the owner created the first one on production.
- **Nothing is built or planned beyond this.** The repo has one branch (`main`, plus `production`) and no worktrees.

## How to ship

1. Open a PR against `main`. CI (`.github/workflows/ci.yml`) runs:
   - gitleaks
   - drizzle drift check
   - `scripts/check-migrations.mjs` (no edits to applied migrations; upgrades from the base branch)
   - unit tests
   - an `E2E_SEED=1` build
   - `pnpm e2e --fail-on-flaky-tests` on Postgres 18
2. Merge. Staging auto-deploys once CI passes (Railway "Wait for CI"). Run `pnpm smoke <staging url>`.
3. Run `git push origin main:production`. Production deploys once CI passes there. Smoke it.

Railway notes (more in memory `railway-config-ignored`):
- Railway ignores `railway.json`. Change deploy settings on the service, through GraphQL `serviceInstanceUpdate` or the dashboard.
- The start command runs `pnpm db:migrate`.
- Production web's `DATABASE_URL` is a literal, so never duplicate production into a new environment.
- `price-sync` exists in production only. It deploys from the `production` branch, skips the Next build, and reads `DATABASE_URL` as a reference to `Postgres`. To run it now, call GraphQL `deploymentInstanceExecutionCreate` with its service instance id.

## Rules that bite

- **Next.js here is not the one you know.** Read `node_modules/next/dist/docs/` first (see `AGENTS.md`).
- **Real 404s come from `src/proxy.ts`.** With `cacheComponents`, the first byte fixes the status. The proxy also turns malformed URIs into 404s, or `/join/*` into a redirect to `/join`.
- **Drop columns in two releases.** Stop reading the column in one release and drop it in the next.
- **Run e2e against a production build** (`CI=1`) before calling anything green. Dev mode hides production bugs.
- **Don't send real email or commit secrets.** Tests use the e2e outbox, and the outbox is refused on Railway.
- **Invites are enforced at account creation** (better-auth `databaseHooks.user.create.before`). `/api/auth/sign-in/magic-link` is disabled, and sends go through our own rate-limited actions (`src/lib/sign-in-limit.ts`).
- **Store state lives in one SQL expression,** in `src/lib/store-state.ts`: open, paused or off, plus the 14 h auto-pause.
- **The server checks its environment at boot** (`src/lib/env-check.ts`). Half a VAPID key set, or `MAGIC_LINK_OUTBOX` or `E2E_SEED` on Railway, stops the deploy.
- **`/api/health` needs the LISTEN connection.** It returns `live: true`, and 503 if the listener can't start. `pnpm smoke` checks both.
- **The e2e projects are `desktop`, `phone` and `tablet`.** Only the journey runs on the last two.
- **The journey's accessibility scan fails CI** on any serious or critical axe violation on the screens it visits.

## Owner to-dos

1. Buy a domain, verify it in Resend and set `EMAIL_FROM`. Until then, mail only reaches the Resend account owner, so an invited vendor can't receive a sign-in link and buyer receipts show "Email didn't send".
2. Test push and the chime on a real phone. Scan a printed sign from 1 m. Open both CSV exports in Excel and Sheets.
3. Check the Railway cron history for `price-sync` the morning after the first vendor adds stock.
4. Before the first public show, decide whether to move PPT to Business ($99/mo). PPT's terms reserve Pro for hobby and pre-launch use (`research/PRICING-API.md`).

## Next up

- [ ] On a phone, "New request" toasts stack over the Confirm sale bar while the seller is on a sale (see `.planning/phases/08-e2e/shots/phone-confirm.png`). Decide whether they should hide on the sale screen.
- [ ] Prices and history only arrive with the nightly run. A card added at a show has no market price until 02:00 UTC. Pricing it on add would cost 1 to 2 credits a card.

## Kept on purpose (don't "fix" without a reason)

- A script can hold stock up to the IP limit.
- The rate limit is per process.
- Sale DELETE trigger.
- `?done=1`.
- No float field.
- The invite code is a bearer code (see `.planning/phases/invites/PLAN.md`).
- The journey seeds its priced catalog cards and doesn't search TCGdex, so CI needs no third-party API.
