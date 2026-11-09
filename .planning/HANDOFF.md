# Handoff

Read this first. Update it at the end of every phase, merge or deploy, in the same PR as the work.

_Last updated: 2026-11-10, at `main` = `production` = `6163573` (PR #13)._

## Where things stand

- **Live:** production https://web-production-2d3b0.up.railway.app and staging https://web-staging-staging-6b4e.up.railway.app both run `6163573`. CI is green and `pnpm smoke <url>` passes on both.
- **Shipped:** phases 1–7 (foundation, inventory, store page, requests, sales and receipts, reports and customers), plus:
  - the CI pipeline
  - the known-gap fixes (PR #11)
  - vendor invites (PR #12)
  - the three store states (PR #13)
- **Not built:** the phase 8 run-a-show journey (`.planning/phases/08-e2e/`).
- **Stale:** `.planning/ROADMAP.md` doesn't reflect invites or store states.

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

## Rules that bite

- **Next.js here is not the one you know.** Read `node_modules/next/dist/docs/` first (see `AGENTS.md`).
- **Real 404s come from `src/proxy.ts`.** With `cacheComponents`, the first byte fixes the status. The proxy also turns malformed URIs into 404s, or `/join/*` into a redirect to `/join`.
- **Drop columns in two releases.** `is_open` is deprecated; drop it in migration `0016` next release.
- **Run e2e against a production build** (`CI=1`) before calling anything green. Dev mode hides production bugs.
- **Don't send real email or commit secrets.** Tests use the e2e outbox, and the outbox is refused on Railway.
- **Invites are enforced at account creation** (better-auth `databaseHooks.user.create.before`). `/api/auth/sign-in/magic-link` is disabled, and sends go through our own rate-limited actions (`src/lib/sign-in-limit.ts`).
- **Store state lives in one SQL expression,** in `src/lib/store-state.ts`: open, paused or off, plus the 14 h auto-pause.

## Owner to-dos

1. Sign in on production and create the first invite at `/admin`.
2. Verify the domain in Resend and set `EMAIL_FROM`. Until then, mail only reaches the account owner.
3. Test push and the chime on a real phone. Open both CSV exports in Excel and Sheets.
4. Decide on the PPT plan, then set `PPT_API_KEY` and create the nightly price-sync cron service (`pnpm sync:prices`).
5. Optional: a custom domain.

## Next up

- [ ] Migration `0016`: drop `stores.is_open`.
- [ ] Phase 8: the run-a-show journey.
- [ ] Refresh `ROADMAP.md`.
- [ ] Prune merged worktrees under `.claude/worktrees/` and their branches.

## Kept on purpose (don't "fix" without a reason)

- A script can hold stock up to the IP limit.
- The rate limit is per process.
- Sale DELETE trigger.
- `?done=1`.
- No float field.
- The invite code is a bearer code (see `.planning/phases/invites/PLAN.md`).
