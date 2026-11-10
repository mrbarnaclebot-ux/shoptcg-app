# Handoff

Read this first. Update it at the end of every phase, merge or deploy, in the same PR as the work.

_Last updated: 2026-11-10. `main` and `production` are level; the last code change is store images (banner and profile image on Pinata)._

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
- **Price on add (PR #18):** a catalog card is priced, with 90 days of history, right after a vendor adds or imports it (`priceNewListings` in `src/lib/sync-prices.ts`, run with `after()`). It costs 1 credit for the price and 2 for history, nothing if the card already has today's price, and at most 200 credits per add or import; the nightly run picks up the rest.
- **Store images:** a vendor sets a banner (1500 x 500) and a profile image (1000 x 1000) under Settings, "Your store page", and both show at the top of their public page.
  - Upload goes to `POST /api/store-image?kind=banner|avatar` (raw body, 4 MB cap, 20 an hour per store). `src/lib/store-image.ts` checks the file is a real JPEG, PNG or WebP, crops around the centre and re-encodes to WebP with `sharp`, which also strips metadata.
  - Files live on the owner's Pinata account (`src/lib/image-store.ts`). `PINATA_JWT` and `PINATA_GATEWAY_URL` are set on `web` and `web-staging`. The URL holds the content hash, so it never changes; replacing or removing an image deletes the old file from Pinata.
  - Without the Pinata variables a deployed server refuses uploads. Locally and in e2e the image is kept in the row as a data URL, so tests never reach Pinata.
  - Migration `0017` added `banner_url`, `banner_file_id`, `avatar_url`, `avatar_file_id`. `stores.logo_url` is no longer read; drop it in the next release.
- **Invites:** the owner created the first one on production.
- **Nothing else is built.** Search and graded-card work is researched but not started (see "Next up"). The repo has one branch (`main`, plus `production`) and no worktrees.

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
- **The server checks its environment at boot** (`src/lib/env-check.ts`). Half a VAPID key or half the Pinata pair set, or `MAGIC_LINK_OUTBOX` or `E2E_SEED` on Railway, stops the deploy.
- **`/api/health` needs the LISTEN connection.** It returns `live: true`, and 503 if the listener can't start. `pnpm smoke` checks both.
- **The e2e projects are `desktop`, `phone` and `tablet`.** Only the journey runs on the last two.
- **PPT calls share one throttle per process.** The web app now makes sync-rate calls after an add, so a big import during the 02:00 run could briefly pass PPT's 60 calls a minute; the client backs off on 429.
- **The journey's accessibility scan fails CI** on any serious or critical axe violation on the screens it visits.

## Owner to-dos

1. Buy a domain, verify it in Resend and set `EMAIL_FROM`. Until then, mail only reaches the Resend account owner, so an invited vendor can't receive a sign-in link and buyer receipts show "Email didn't send".
2. Test push and the chime on a real phone. Scan a printed sign from 1 m. Open both CSV exports in Excel and Sheets.
3. Check the Railway cron history for `price-sync` the morning after the first vendor adds stock.
4. Before the first public show, decide whether to move PPT to Business ($99/mo). PPT's terms reserve Pro for hobby and pre-launch use (`research/PRICING-API.md`).

## Next up

- [ ] On a phone, "New request" toasts stack over the Confirm sale bar while the seller is on a sale (see `.planning/phases/08-e2e/shots/phone-confirm.png`). Decide whether they should hide on the sale screen.
- [ ] Price on add has only run against TCGdex (free). Add one real card on production and check it shows a market price and a chart within a minute.
- [ ] Drop `stores.logo_url` (unused since store images shipped).
- [ ] An admin can't remove a vendor's banner or profile image yet. Until that exists, clear the four columns in the database and delete the file in the Pinata dashboard.
- [ ] Graded cards show cropped: the scan sits in a 3:5 box with `object-cover` (`ART_ASPECT.graded` in `src/app/[slug]/tile.tsx`, and `card-thumb.tsx`). Use the card's own shape, `aspect-[63/88]`.
- [ ] Catalog search, from the 2026-11-10 review, in this order:
  1. Small bugs: a "busy" search still counts as an hourly miss, and the LIKE escape in `src/lib/catalog.ts` does nothing. Show "no price yet" on a card added moments ago.
  2. Graded search lists one row per grade, which reads as duplicates. Show one result per card and let the vendor pick grader and grade in the add panel; create the graded catalog row then.
  3. Speed: searches wait on the shared 4 s PPT gap and the local cache only matches prefixes. Cache whole queries, cancel stale searches, and consider trigram matching.
  4. Unchecked: whether sealed products get a price (the single-item PPT response has a different shape).

## Kept on purpose (don't "fix" without a reason)

- A script can hold stock up to the IP limit.
- The rate limit is per process.
- Sale DELETE trigger.
- `?done=1`.
- No float field.
- The invite code is a bearer code (see `.planning/phases/invites/PLAN.md`).
- The journey seeds its priced catalog cards and doesn't search TCGdex, so CI needs no third-party API.
