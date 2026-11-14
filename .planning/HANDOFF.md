# Handoff

Read this first. Update it at the end of every phase, merge or deploy, in the same PR as the work.

_Last updated: 2026-11-13. The product is **tcgmart.app**. `main` and `production` are level after PR #46 (condition pricing, recent sales, perf quick wins); #45 online checkout; #41 change email, delete account, requester emails, Sentry wiring; #40 password sign-in and invite requests; #39 app icon, #38 help screenshots, #37 onboarding tips and `/help`. The app icon is static PNGs (`public/icon-192.png`, `public/icon-512.png`, `src/app/apple-icon.png`, `src/app/icon.png`, `src/app/favicon.ico`) cut from an OpenRouter (Gemini image) render the owner picked. Production serves https://tcgmart.app and staging https://staging.tcgmart.app; both switched, redirected and smoked on 2026-11-13. Email sends from the verified tcgmart.app Resend domain (`EMAIL_FROM` set 2026-11-13; a real sign-in link was delivered from `receipts@tcgmart.app`)._

## Where things stand

- **Live:** production https://tcgmart.app (also `www.tcgmart.app`) and staging https://staging.tcgmart.app. The Railway hosts (`web-production-2d3b0.up.railway.app`, `web-staging-staging-6b4e.up.railway.app`) stay attached forever and 308 to the custom domain, because printed signs point at them. Migrations are up to `0029`.
  - Domains were added with the Railway CLI (`railway domain`). DNS lives at the owner's registrar (CNAME + `_railway-verify` TXT per host). Each service has `BETTER_AUTH_URL` and `CANONICAL_HOST` set to its custom domain.
- **Shipped:** all eight phases, plus:
  - password sign-in (2026-11-13): `/login` is email + password; `/login/forgot` emails a reset link (1 hour) that lands on `/login/reset` and signs straight in. Email links are only for invites now: `/join` (code + email), an admin "Email it to" invite, or approving a request from `/join`'s "No code yet?" form (`invite_request`, migration `0027`, queued on `/admin`, admins emailed). The invite link (48 hours) makes the account and lands on `/welcome` to choose a password. Accounts from before passwords see a "Set a password" nudge on the dashboard, or use Forgot password. Sessions last 30 days, refreshed daily. Every Better Auth HTTP route for sign-in, sign-up and resets is disabled; server actions call `auth.api` behind `src/lib/sign-in-limit.ts`. More → Account has Change password (signs other devices out), Change email (password + a 1-hour link to the new address via `src/lib/account.ts`, stored hashed in `verification`; confirm is a button so mail scanners can't trigger it; the old address gets a notice) and Delete account (types "delete my account" + password; deletes the user row, which cascades the store, sales, ledger and customers, then drops Pinata images and sends a notice). Invite requesters get a "we got it" email and a decline email if dismissed.
  - error monitoring: `@sentry/nextjs` (`src/sentry.server.ts`, `src/instrumentation-client.ts`, `onRequestError`, every `error.tsx` via `useReportError`). It is off unless `SENTRY_DSN` is set; `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT` at build upload source maps. No PII is sent.
  - onboarding: a "Getting started" checklist on the dashboard (`src/app/dashboard/getting-started.tsx`) whose ticks come from the store's data; "Hide tips" sets `store.tips_dismissed_at` (migration `0026`) so it shows once per store. The public guide is `/help` (`src/app/help/page.tsx`), linked from the checklist, More → Help, the landing footer and the sitemap. Its screenshots are `public/help/*.jpg`, made by `SHOTS=help pnpm e2e help-shots --project desktop`; rerun that and keep the copy in step when a feature changes.
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
  - Migration `0017` added `banner_url`, `banner_file_id`, `avatar_url`, `avatar_file_id`. Migration `0023` dropped the old `stores.logo_url`.
- **Settings and admin:**
  - "More" (`/dashboard/settings`) is a menu on a phone and a side list on desktop (`settings/menu.tsx`, `settings/layout.tsx`). Each section is its own page with its own Save: `store` (name, images), `pricing`, `table`, `alerts`. The menu works without a store, so an admin with no store can reach `/admin`.
  - The store name can be changed. The link (slug) can't, and old receipts keep the old name.
  - `/admin` now also shows each vendor's store, state, stock count and last sale, with "Stop store" and "Remove images", and a System list (last price date, plus the boot warnings from `env-check.ts`).
  - "Stop store" sets `stores.suspended_at` (migration `0018`). While set, `storeState` is `off` whatever the vendor chose, and the vendor's dashboard says so in place of the open/pause control.
  - Admins are still the `ADMIN_EMAILS` variable (the owner's address on both environments).
- **Preview mode:** `/dashboard/preview` shows the vendor's real store page in a frame (phone width by default, with a desktop switch), as it looks open, whatever state it is in.
  - The page sets a `preview` cookie in the browser (`src/lib/preview-cookie.ts`). `previewing(slug)` in `src/lib/preview.ts` honours it only for the signed-in owner of that store, so the cookie alone opens nothing. `storeOr404` then reports the store as open.
  - A list sent in preview is a test request (`isTest`), open or not.
  - Outside the frame the store page carries an orange strip that says what buyers get right now, with "Exit preview" (`/dashboard/preview/exit` clears the cookie). The cookie lasts an hour.
- **Live baskets and visitor counts ("the floor"):** the dashboard has a second section, "At your table", with how many people are on the store page now, how many today, and every unsent list.
  - A buyer's browser keeps a random id per store (`deviceId` in `src/app/[slug]/list-island.tsx`) and `presence.tsx` posts it with the unsent list to `POST /api/visit`: on load, every 30 seconds in view, and just after the list changes. Not the IP, because a whole venue shares one.
  - Tables `visit` and `basket` (migration `0019`), logic in `src/lib/floor.ts`. "On the page now" means a ping in the last 90 seconds. A list stays 30 minutes after the buyer leaves, marked "Left the page".
  - Each list has a three-character tag (`src/lib/basket-tag.ts`) shown on the buyer's list bar and on the vendor's card, so the vendor can match a list to a person. A list holds no stock; the same item on two lists is flagged "Also on 1 other list".
  - The vendor's own visits never count (owner session check in the route). Lists exist only while the store is open. Nothing chimes; the dashboard re-reads on a `floor` live event and at least once a minute.
  - Limits are per store (60 open lists, 2,000 new visits a day). Visits are deleted after 30 days. The terms have a "Browsing a store" section.
  - Not built: a stored daily total. Counts older than 30 days are gone; add a daily row when the ledger wants a funnel.
- **Ledger (step 4, first half):** `/dashboard/ledger`, linked from Sales and More, shows for any day range: takings after discounts, what the sold items cost, profit, stock on hand valued at market and at cost, and every stock change.
  - Every quantity change writes a `stock_move` row from a database trigger (`listing_stock_move`, migration `0020`), so no code path can skip it. The reason comes from a transaction setting: call `stockReason(tx, "sold", saleId)` in `src/lib/ledger.ts` before changing quantities. Unlabelled changes are "added" (new listing) or "adjusted". Existing stock got an "opening" row.
  - Cost is optional per listing (`listing.cost`, private to the vendor), set in either add form, the inventory edit panel (all share `CostField` in `edit-panel.tsx`) or a `cost` CSV column. It is copied to `sale_line.unit_cost` when sold. Profit only counts lines that have a cost and says how many were left out.
- **Voids (PR #24):** a vendor voids a whole sale from its detail page, with "Put the items back in stock" ticked by default and an optional reason (80 characters at most). A `sale_void` row (migration `0022`) marks it. The sale itself never changes, and there is no un-void or partial void.
  - `voidSale` in `src/lib/sales.ts` writes "voided" stock moves through `stockReason`, skips listings deleted since the sale, and caps at 9,999. A second void does nothing.
  - `inRange` in `src/lib/reports.ts` leaves voided sales out of the report, CSV and ledger. The Sales tab and the dashboard "Today" line list them marked "Voided", outside the totals.
  - The receipt and the buyer's page say the sale was voided. No email is sent, and Resend is hidden. A `voided` live event refreshes open dashboards.
- **Table sale (quick sale for walk-up buyers):** an in-stock, priced, visible inventory row has a "Sell" button. Each tap adds one unit to the store's one open table sale, a request with `request.walk_up` (migration `0021`), named "Walk-up". A bar on Inventory shows its items and total and links to the normal sale screen.
  - Logic in `addToTableSale` and `tableSale` (`src/lib/requests.ts`). The store row is locked first so two quick taps make one sale. Units are held like any buyer's list, and each tap renews the hold.
  - `sale.buyer_email` is now nullable. A table sale has no email, so it makes no customer record and no receipt email, and the receipt page says "Sold at the table".
  - It never chimes and is left out of the "waiting" count. Confirming doesn't check store state, so it can be sold while paused.
  - Covered by a unit test in `src/lib/sales.test.ts` and `e2e/table-sale.spec.ts`.
- **Ledger part two (PR #28): buys, float, cash check.** "Buy" on Inventory, or "Record a buy" on Ledger, opens `/dashboard/buy`. Pick from stock or add a custom item, then pay with cash, card, PayPal or trade (store credit; no cash moves).
  - `recordBuy` in `src/lib/buys.ts` locks the store, then the listings, labels the change with `stockReason(tx, "bought", buyId)` and adds the stock. The price paid becomes `listing.cost`, averaged with the cost of units on hand when that is known. The buy id comes from the browser, so a repeat records nothing (migration `0024`: `buy`, `buy_line`, `till`).
  - Opening the store starts a cash box (`till`, `src/lib/till.ts`) if none is open. It lasts through pauses and the 14 h auto-pause; `store-state.ts` is unchanged. The float is set on the dashboard.
  - The dashboard's cash check closes the box and saves counted and expected. Expected = float + unvoided cash sales − cash buys since the box opened. It is saved at close, so a later void doesn't change it.
  - The ledger shows buys (money out, not in takings or profit) and cash checks with over or short. Buys have their own CSV at `/dashboard/ledger/buys`.
  - Not built: catalog search in the buy flow (add a priced card at qty 0 first), and linking a trade to a sale.
- **Production readiness (PR #30):** security headers on every response (HSTS, nosniff, Referrer-Policy, Permissions-Policy, SAMEORIGIN framing). The CSP has only `frame-ancestors`, `base-uri`, `object-src` and `form-action`, because nonces don't work with `cacheComponents`.
  - `CANONICAL_HOST` (off when unset) makes `src/proxy.ts` 308 any other host to the custom domain; `/api/health` and POSTs are exempt. The boot check refuses a mismatch with `BETTER_AUTH_URL`. The proxy now runs on every path; `CHECKED` decides which get store or session checks.
  - `robots.txt` and `sitemap.xml` are real (the sitemap lists vending stores only). There is a root `error.tsx` and `global-error.tsx`. The boot check and `/admin` warn about `EMAIL_FROM`; `pnpm smoke` checks headers and robots.
- **Add-stock search (PR #31):** the add screen calls `POST /api/catalog-search` twice: `cached` returns catalog rows at once, then `fresh` asks the provider (unless that query was answered in the last 10 minutes) and merges, ranked exact number, then name starts with, then contains (`searchCached`, `searchFresh`, `mergeRows` in `src/lib/catalog.ts`). Every word must match name or set name, any order; a number-like word can match the card number. CSV import still uses `searchCatalog`, where any cached hit wins.
  - Background PPT calls (`SYNC_RATE.yields`) wait while a search is queued, so imports no longer make searches "busy". E2E builds search a fake provider (`src/lib/pricing/e2e.ts`). Every new query now costs a provider call after typing pauses. Not done: rarity (needs a column).
- **Storefront (PR #32):** every tile shares one 63:88 art box (catalog cards fill it; sealed and vendor photos show whole) with fixed text rows, so a grid row lines up; `e2e/storefront.spec.ts` checks it at three widths.
  - Buyers have a **cart**: `/[slug]/cart`, and the proxy 308s the old `/[slug]/list`. The localStorage key is still `list:<slug>`.
  - The item page has tap-to-zoom art, a details list, a quantity picker, an in-cart state, back-to-store that keeps filters and scroll, Share, and OG metadata. The store page has a description and OG image (banner, else avatar).
  - Migration `0025` adds `store.selling_mode` (`table` | `online`), set under More, "How you sell". All mode wording and hold lengths live in `src/lib/selling-mode.ts`; read copy from there instead of branching on the mode.
  - Online mode: no 14 h auto-pause (an `ENDLESS` term inside the single store-state expression), 24 h buyer holds, no table number, and the hold clock shows h:mm:ss. Walk-up and test requests keep 15 min. `TERMS_VERSION` is `2026-11-12`.
- **Toasts on the sale screen (PR #25):** while a `[data-toast-clear]` bar is on screen (the Confirm sale bar), toasts stay at the top and show only the newest two. The chime is unchanged.
- **Graded art** shows in the card's own shape, `aspect-[63/88]`, in `tile.tsx` and `card-thumb.tsx`.
- **Catalog search (PR #27):**
  - A "busy" search no longer counts against the hourly limit (`missLimit`, `SearchBusyError`). The LIKE escape works. A card added in the last 10 minutes with no price says "No price yet".
  - A graded search returns one row per raw card. The add panel asks for grader and grade, and `gradedItem` creates the graded catalog row then. CSV import matches slabs the same way. A grade PPT has no sales for gets no price.
  - Every provider answer is cached per process for 10 minutes for the whole query, before the prefix match.
  - Not done: trigram matching (the migration is sketched in PR #27). Price on add shares the search throttle, so searches say "busy" during a big import.
  - Unverified live: the shape of a sealed lookup by id and its history. The parser now accepts an object or a one-item list. One real sealed price on production settles it.
- **Invites:** the owner created the first one on production.
- **In progress:** nothing. The five-step plan is done; what's left is under "Next up" and "Owner to-dos".

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

1. Done 2026-11-13: `tcgmart.app` is verified in Resend (DKIM, SPF on `send`, `rsend` CNAME, DMARC `p=none` in Porkbun). `EMAIL_FROM` is `tcgmart <receipts@tcgmart.app>` on `web` (production env) and `tcgmart staging <staging@tcgmart.app>` on `web-staging` (**staging env**, not production). The production `RESEND_API_KEY` is now full-access; swap it for a send-only key when convenient.
5. Turn on Railway Postgres backups (daily) and test a restore once. Uptime: done 2026-11-13 in UptimeRobot (5-minute checks on `https://tcgmart.app/`, `/api/health` and `https://staging.tcgmart.app/api/health`, alerting the owner's email; the API key is `UPTIMEROBOT_API_KEY` in the local `.env`). Error monitoring: done 2026-11-13. Sentry org `mrbarnacle`, project `tcgmart` (https://mrbarnacle.sentry.io); `SENTRY_DSN` is set on `web` and `web-staging`, and a test browser error from staging landed tagged `staging`. Source maps upload on every build (2026-11-14): `SENTRY_AUTH_TOKEN` (org token `railway-builds`, also `SENTRY_TOKEN` in the local `.env`), `SENTRY_ORG=mrbarnacle`, `SENTRY_PROJECT=tcgmart` are set on both services. The build's "onRouterTransitionStart" notice is for navigation tracing, which the browser SDK leaves off on purpose.
6. Reprint table signs at leisure: new ones say tcgmart.app; old ones keep working through the redirect.
2. Test push and the chime on a real phone. Scan a printed sign from 1 m. Open both CSV exports in Excel and Sheets.
3. Check the Railway cron history for `price-sync` the morning after the first vendor adds stock.
4. Before the first public show, decide whether to move PPT to Business ($99/mo). PPT's terms reserve Pro for hobby and pre-launch use (`research/PRICING-API.md`).

## Next up

- [x] Condition pricing and recent sales (2026-11-14, migration `0029`). Played singles are priced at a store share of the Near Mint market (LP 85, MP 70, HP 55, DMG 40 by default; Pricing settings, `store.cond_*_pct`), applied in SQL in `listStock`, so every price (store page, cart quote, sale snapshot, ledger) follows. The item chart scales by the same share. `price_point.sales` holds copies sold per day: the nightly PPT call for singles now adds `includeHistory&days=7` (+1 credit, the owner's choice) for TCGplayer NM volume, and slabs read eBay/Fanatics daily counts from the `includeEbay` data they already fetch. Sync budgets credits per item (`priceCost`: PPT single or slab 2, else 1), which also fixes graded being counted as 1. The item page shows "Recent sales" (last 30 days with sales, 10 rows); sealed has no sales data. Individual sold listings need PPT Business and are graded-only.
- [ ] Perf follow-ups from the 2026-11-14 audit (store page mobile LCP 6.0 s, the rest 89-99): Pinata banner through `next/image` (needs the gateway host in `remotePatterns` at build), `motion` only for the Stepper (40 KB gz on the store page; `LazyMotion` or CSS), Sentry 60 KB gz on every page (`__SENTRY_TRACING__: false` under Turbopack), store search via `next/form`, `storeSummary` inside Suspense, `latestPrices` as a LATERAL join once stores hold 300+ items. Done then: proxy item 404 is a one-row lookup, live events coalesce per 400 ms burst, only latin font preloaded, avatars stored at 400 px, zod off the dashboard client. Not worth it yet: a load balancer (the PPT throttle, search cache and SSE caps are per process) or a CDN in front.
- [ ] Price on add, in the app on production. 2026-11-14: the PPT adapter (`src/lib/pricing/ppt.ts`) returned live search, price and 29 days of history for Charizard ex 199/165 ($291.77) and a Prismatic Evolutions ETB ($187.33; its top sealed hit was the Sam's Club bundle, so watch sealed ranking). Still to do: add one card and one sealed product from a real vendor account and see the price and chart within a minute.
- [ ] The owner's plan from 2026-11-10, one PR per step:
  1. ~~Settings and nav rework, admin entry and vendor controls.~~ Shipped.
  2. ~~Preview mode.~~ Shipped.
  3. ~~Live baskets and visitor counts.~~ Shipped.
  4. ~~Ledger part one: stock moves, cost and profit, table sale, voids, cost on add.~~ Shipped.
  5. ~~Ledger part two: buys and trade-ins, float and a cash check at close.~~ Shipped (PR #28).
  - Sales tax is left out unless the owner asks for it.
- [ ] Search: trigram index if the unindexed ILIKE gets slow (sketch in PR #27); a rarity column for result rows.
- [x] Online checkout (2026-11-14, migration `0028`): an online store turns on delivery, pickup, cash and bank transfer under How you sell → Online orders, with free-text bank details and a buyer note (`src/lib/checkout.ts`). The cart asks only what's offered (one option is shown as a fact); delivery needs an address and phone. Transfer buyers see the bank details on their order page with the code as reference; the seller's review shows the choices, address and a `tel:` link, and preselects the payment method. Phone and address are cleared 30 days on, sold or not. Table stores ask nothing. Built for Sri Lanka first (cash on delivery, PickMe Flash / Uber parcel, transfers); no country-specific fields, so it fits global vendors.
- [ ] Online checkout follow-ups if vendors ask: email the transfer details to the buyer (today only the order page shows them), a delivery fee line, WhatsApp link for the buyer's phone.

## Kept on purpose (don't "fix" without a reason)

- A script can hold stock up to the IP limit.
- The rate limit is per process.
- Sale DELETE trigger.
- `?done=1`.
- The invite code is a bearer code (see `.planning/phases/invites/PLAN.md`).
- The journey seeds its priced catalog cards and doesn't search TCGdex, so CI needs no third-party API.
