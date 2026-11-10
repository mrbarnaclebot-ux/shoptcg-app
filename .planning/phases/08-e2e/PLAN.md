# Phase 8: Run-a-show journey + deploy

Branch `phase-8-e2e`. Runs after phases 4 to 7 are merged. Autonomous run: every decision below is final unless a check fails.

## Goal

One Playwright journey proves the one-month success criterion end to end ("a vendor runs one full card show on it") across a vendor context and two buyer contexts at 390, 768 and 1280 px, and the app is deployed to Railway with a checked, repeatable checklist.

## User stories

1. Owner: one command (`pnpm e2e e2e/run-a-show.spec.ts`) tells me the whole show still works.
2. Owner: I can deploy from a clean machine by following one checklist, and the price sync runs every night without me.

## Decisions (default and why)

| Topic | Decision | Why |
| --- | --- | --- |
| Viewports | Three Playwright projects in `playwright.config.ts`: `phone` (390 x 844, `isMobile`, `hasTouch`, Chromium Pixel-like UA), `tablet` (768 x 1024), `desktop` (1280 x 800). The journey runs in all three; other specs keep running on `desktop` only (`testMatch`). | Covers the three layouts without tripling CI time for every spec. |
| Contexts | Vendor and buyer roles in the same viewport per project (a show has phones on both sides; desktop covers the laptop seller). Buyer B is a second fresh context for the race. | Two-sided realtime is the core risk. |
| Data | Each run creates its own vendor via `newVendor()` (unique slug), adds stock through the real UI (2 catalog adds via TCGdex fixtures path with `PPT_API_KEY=""`, 1 custom CN item, 1 CSV import of 3 rows). No DB seeding except the expiry env. | Exercises phase 3 too. |
| Emails | Outbox only (`MAGIC_LINK_OUTBOX`), never Resend. | No real mail from tests. |
| Expiry | Not in the journey. The journey covers release through a decline; expiry stays in `requests.spec.ts` with `HOLD_MINUTES`. | One web server config for the whole suite. |
| Hold sweep | In-process timer (phase 5), so no Railway cron service for holds. | Railway cron minimum interval is 5 minutes. |
| Price sync time | 02:00 UTC daily. Update the comment in `scripts/sync-prices.ts` (currently says 06:00). | Owner's schedule; quiet hours for all EN/AU/US shows. |

## The journey (`e2e/run-a-show.spec.ts`, one `test` with `test.step`s)

1. Vendor signs in (outbox), creates store, sets rule -10 %, rounding 0.50, AUD 1.52, table label B14, NFC on. Toast "Settings saved".
2. Adds stock: 2 catalog cards (one raw NM qty 1, one graded), 1 custom CN item at $25, CSV import of 3 rows. Inventory shows 6 rows.
3. Prints sign: `/dashboard/sign` shows table B14, NFC line, QR SVG; `page.pdf({format:'A5'})` is one page (desktop project only; PDF is Chromium-headless only).
4. Opens store (toggle Open).
5. Buyer A (fresh context) visits `/<slug>?src=sign`: 6 items, approx A$ lines, under-market stamp where the override sits 10 % below market, filters JP/CN and Graded narrow the grid, item detail chart or "Not enough price history yet."
6. Buyer A adds the last-copy raw card + the CN item, sends with name, email, promo ticked. Waiting screen shows code and countdown.
7. Vendor queue shows the ticket within 3000 ms, code matches buyer A's stub.
8. Buyer B (fresh context) sees the raw card "On hold" and cannot add it.
9. Buyer B adds the graded card, sends; vendor declines it; buyer B sees "The seller couldn't do this one."; graded card is available again.
10. Vendor opens buyer A's request, sets CN item price to $22, 10 % discount, Cash, confirms "Confirm sale, $X". Toast "Sale R-0001 recorded".
11. Buyer A's screen shows "Sold. Enjoy your cards!" within 3000 ms; outbox has `receipt:R-0001` with an unsubscribe URL.
12. Store page: raw card "Sold out", CN item qty decreased.
13. Report "Today": 1 sale, Cash total equals the receipt total, best sellers list both items; CSV download row count 2.
14. Customers: buyer A "Subscribed since"; open the outbox unsubscribe URL, press Unsubscribe; promo export now has 0 rows (button disabled with "No one has opted in yet.").
15. Close store: buyer A's store page shows "Browsing only." and no list bar.
16. Accessibility smoke at each major screen: `@axe-core/playwright` (devDependency) with no serious or critical violations on store page, list, waiting, queue, confirm, receipt, report.
17. Shots per step saved to `.planning/phases/08-e2e/shots/<project>-<step>.png`.

Budget: journey < 90 s per project locally; whole suite < 8 min in CI.

## Tasks (in order, each with its check)

1. Add `phone` / `tablet` / `desktop` projects with `testMatch`. Check: `pnpm e2e --list` shows the journey under three projects and other specs under desktop only.
2. Shared helpers in `e2e/show.ts` (add stock, send list, read outbox receipt line). Check: `requests.spec.ts` and `sales.spec.ts` refactored to use them and still pass.
3. Write the journey steps 1 to 15. Check: `pnpm e2e e2e/run-a-show.spec.ts` green on all three projects twice in a row (no flake).
4. axe step + shots. Check: zero serious/critical; shots reviewed.
5. Production env validation: extend `instrumentation.ts` `envSchema` with `PPT_API_KEY` (optional string, warn if missing), `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` (all or none), `EMAIL_FROM` (optional). Refuse `HOLD_MINUTES`, `RECEIPT_EMAIL_FAIL`, `MAGIC_LINK_OUTBOX` when any `RAILWAY_*` var is set. Check: Vitest for the guard.
6. `/api/health` also reports `{ live: true }` once the LISTEN connection is up (503 if the listener failed to start). Check: curl locally.
7. Fix the sync script comment to 02:00 UTC. Check: grep.
8. Deploy per checklist below, then run the journey against production with a real phone (manual, owner).

## Deploy checklist (Railway)

**Important: this project's Railway service ignores `railway.json`.** Settings live on the service instance. Set them with the GraphQL `serviceInstanceUpdate` mutation (or the dashboard), then run a fresh `railway up` after any config change so the new settings take effect. Keep `railway.json` in the repo only as documentation of intended values.

Pre-flight (owner):
- [ ] `railway login` (CLI session expired on the dev machine).
- [ ] Domain: confirm shoptcg.app ownership, add Railway custom domain, add Resend SPF + DKIM + return-path records, verify in Resend. Until verified, `EMAIL_FROM` stays `onboarding@resend.dev`, which only delivers to the Resend account owner (buyer receipts will show "Email didn't send").
- [ ] PPT plan: Business ($99/mo) decided before the first real show (PRICING-API.md); Pro is dev only.
- [ ] VAPID keys generated once locally: `pnpm dlx web-push generate-vapid-keys`; stored only in Railway variables and the owner's password manager. Never commit, never print `.env`.

Services (one project, one environment `production`):
1. **web** (Next.js): source = this repo `main`. Instance settings via `serviceInstanceUpdate`: `startCommand: "pnpm db:migrate && pnpm start"`, `healthcheckPath: "/api/health"`, `healthcheckTimeout: 120`, `restartPolicyType: ON_FAILURE`, `numReplicas: 1` (LISTEN/NOTIFY, in-process sweeper and in-memory rate counters assume one instance). Builder Railpack, Node 22.
2. **postgres**: Railway Postgres; `DATABASE_URL` referenced into web and price-sync as `${{Postgres.DATABASE_URL}}`. Enable backups.
3. **price-sync** (cron): same repo, `startCommand: "pnpm sync:prices"`, `cronSchedule: "0 2 * * *"` (02:00 UTC), `restartPolicyType: NEVER`, no healthcheck, no public domain. It exits 1 on failure so Railway marks the run failed.
4. No hold-sweep service: the sweep runs inside web every 60 s (Railway cron minimum is 5 min).

Variables:
| Var | web | price-sync | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | yes | reference variable |
| `BETTER_AUTH_SECRET` | yes | no | 32+ random bytes; also HMAC key for IP hashes |
| `BETTER_AUTH_URL` | yes | no | `https://shoptcg.app` (QR codes and email links use it) |
| `RESEND_API_KEY` | yes | no | |
| `EMAIL_FROM` | yes | no | `shoptcg <receipts@shoptcg.app>` after DNS verify |
| `PPT_API_KEY` | yes (search) | yes (sync) | Business key before first show |
| `SYNC_MAX_CALLS` | no | yes | default 5000 |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | yes | no | `mailto:` owner address |
| `NODE_ENV` | `production` | `production` | |
Must NOT be set anywhere deployed: `MAGIC_LINK_OUTBOX`, `HOLD_MINUTES`, `RECEIPT_EMAIL_FAIL` (startup refuses).

Rollout:
- [ ] Set instance settings via `serviceInstanceUpdate` for web and price-sync; verify with `railway status` / dashboard.
- [ ] `railway up` (fresh) for web; watch logs for migrate + "Ready".
- [ ] `curl https://shoptcg.app/api/health` -> `{ ok: true, live: true }`.
- [ ] `curl -sI https://shoptcg.app/does-not-exist-store` -> `404`.
- [ ] Trigger price-sync once manually from the dashboard; log shows `[sync] done`; `price_point` has today's rows.
- [ ] Owner phone test: install dashboard to home screen (iOS), allow notifications, [Test alert] arrives locked.
- [ ] Print an A5 sign, scan with iPhone and Android from 1 m.
- [ ] Run the journey by hand with two phones; send a real receipt to the owner's address.
- [ ] Lighthouse mobile on the live store page: LCP < 2.5 s.
- [ ] Next morning: price-sync run at 02:00 UTC succeeded (Railway cron history).
- [ ] Update ROADMAP: phases 4 to 8 status, remove resolved open items.

## Definition of done

- Journey green on phone, tablet and desktop projects in CI, twice in a row.
- axe: no serious or critical violations on the listed screens.
- Production deployed via the checklist with every box ticked (or a noted reason), healthcheck green, real 404 for unknown slugs, cron run succeeded once.
- Seller ping < 3 s and LCP < 2.5 s measured on production.

## As built (2026-11-10)

Where the build differs from the plan above, and why:

- **Stock comes from the seed route plus the real UI.** The plan asked for two catalog adds through TCGdex. That would put a live third-party API in CI, and TCGdex prices are never shown, so there would be no market price, stamp or chart to check. The journey seeds priced catalog cards (`/api/e2e/seed`, what a nightly sync leaves behind), then adds one custom item and imports three CSV rows through the UI. The CSV rows are Chinese, which are never looked up.
- **Projects are `desktop`, `phone` and `tablet`.** `desktop` replaces `chromium` and runs every spec; the other two run only the journey.
- **No `e2e/show.ts`.** The shared helpers already lived in `e2e/buyer.ts`; the report helpers moved there.
- **Env checks are `src/lib/env-check.ts`.** `HOLD_MINUTES` and `RECEIPT_EMAIL_FAIL` no longer exist (they became cookies honoured only by E2E builds), so the deployed refusals are `MAGIC_LINK_OUTBOX` and `E2E_SEED`.
- **Shots are opt-in:** `SHOTS=journey pnpm e2e run-a-show`.
- **The accessibility scan found three real faults,** all fixed: the set name on a sold-out tile was faded below readable contrast, and the totals lists on the sale form and the receipt held a paragraph where only term and value pairs are valid.
- **Deploy** went through the pipeline in `HANDOFF.md` (PR, CI, staging, `production` branch), not `railway up`. The price-sync cron service runs on the PPT Pro plan by the owner's decision.

Not done here, owner only: the real-phone checks, the printed sign scan, Lighthouse on a live store page.
