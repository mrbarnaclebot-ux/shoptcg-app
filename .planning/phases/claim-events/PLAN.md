# Claim events

Branch `claim-events`. Migration `0032`. Drafted 2026-11-17 from the owner's answers; nothing is built yet.

## Goal

An online store runs a timed claim sale. The vendor picks cards or sealed product from inventory, sets a start and an end, and shares one link. Buyers enter their name, WhatsApp and email once, then claim with one tap. The last unit can only be claimed once. The event ends at its end time or when everything is claimed. The vendor contacts each buyer on WhatsApp, marks the claim as paid, and the buyer gets an email receipt.

## Decisions

| Topic | Decision | Why |
| --- | --- | --- |
| Which stores | Online stores only (`selling_mode = 'online'`). | Owner. |
| A claim is a request | Each buyer has one `request` per event, with `claim_event_id` set. Each claim adds a line to it. | Reuses the listing `FOR UPDATE` lock, `active_hold`, confirm, receipts, voids, the ledger and live events. The last unit can't be claimed twice because claims are processed one at a time on that lock. |
| Mark as paid | This is the existing confirm-sale screen, with the payment method preselected. It sends the receipt email. | Owner. No new sale path. |
| Buyer details | Name, WhatsApp and email are all required, and remembered on the phone (localStorage). WhatsApp is stored as digits with the country code; a number with no code gets the code from the vendor's `store.whatsapp`. | Owner: email is for the receipt. `wa.me` needs a full international number. |
| Prices | Per event, a choice: market (the store's normal price rule, worked out at claim time) or custom (a price per item, entered when building the event). The price is snapshotted on the line, so a nightly price sync can't change it. | Owner. |
| Buyer unclaim | A per-event switch the vendor sets when creating the event. When on, a buyer can drop a line until the event ends. | Owner. |
| Released units | A decline or unclaim before the end puts the unit back in the event, and a sold-out event goes live again. After the end, the unit goes back to the normal store. | Owner. |
| Where event stock shows | Event listings are kept out of the normal store, the cart and the table-sale "Sell" button from creation until the event ends. The event has its own page, `/[slug]/claim/[eventId]`, and the store page shows a banner for a scheduled or live event. After the end, the event page says "This event has ended", and unclaimed stock shows in the normal store again. | Owner: event stock is shown separately and hidden once the event ends. |
| Status | Computed in SQL from `now()`, the way `storeState` is: `scheduled` before `starts_at`, `live` until `ends_at` or `ended_at` (the vendor ends it early), `sold_out` while nothing is left, `ended` after. No cron job. | The same pattern as store state; no timer to drift. |
| Clock | The server checks the window inside the claim transaction. The page counts down from milliseconds-remaining sent by the server, not from the phone's clock. | Fairness at the start. |
| Hold length | Lines in a claim request are held until `ends_at` plus the event's pay-within window (24 h by default, chosen per event). Unpaid claims then lapse like any request, and the vendor can decline sooner. | A claim mustn't lapse during the event. |
| Multiple items | A buyer can claim as many items as the event's per-buyer cap allows. The cap is required: the vendor picks it (default 5), and each item also has its own cap (default 1). The normal request limits (3 sends per 10 minutes, 2 pending per store) don't apply to claims. | Owner: several items per buyer, never everything. |
| Joining | A buyer joins once per event, before or during it, with name, WhatsApp, email and a Cloudflare Turnstile check. Joining creates their claim request with no lines yet. The phone, the email and the browser cookie must each be unique per event. Each claim is checked against the joined request (looked up by cookie), so a script can't skip the join. | One Turnstile check per buyer stops bot sign-ups without slowing claims. Joining before the start also spreads out the opening rush. |
| Bot limits | At most 1 claim per second per buyer. At most 10 joined buyers per IP per event (high enough for shared mobile networks). | Humans tap slower than once a second. The IP cap limits one machine running many identities. |
| Vendor remedy | On the vendor's claims list: "Release all" for one buyer (a decline that returns the units to a live event) and "Block" (that number and email can't join this store's events again). | Whatever gets past the limits, the vendor can undo in two taps. |
| Live stock for buyers | The event page checks `GET /api/claim/[eventId]` (available per item, status, ms left) every 3 seconds while live, and right after the buyer's own claim. | Simpler than a public live feed (SSE) and fine for a few hundred buyers on one process. |
| Vendor's live view | The event page in the dashboard lists claims by buyer, with a `wa.me` link, the items, the total and "Mark as paid" or "Decline". It refreshes on the existing `new`, `cancelled` and `confirmed` events, plus a new `claim` event that fires when a line is added or dropped. | Reuses the dashboard's live hub. |
| Editing during an event | Once an event has claims, its items can't be removed. A listing in an event can't be deleted, and its qty can't go below what's held; the inventory panel says why. The event can be ended early but not restarted. | `request_line` cascades on listing delete, so a claim would vanish silently. |
| One at a time | At most one event per store is scheduled or live. | Keeps the store banner and the hiding rule simple. |
| Terms | Bump `TERMS_VERSION` and add a "Claim events" section to the terms page. Buyer phone numbers are already purged after 30 days by `request-sweep.ts`. | We collect phone numbers. |
| Not in v1 | Backup claims (next in line), automatic WhatsApp messages (needs the WhatsApp Business API), OTP to verify numbers, more than one event at a time, events for table stores. | Scope. |

## Schema (migration `0032`)

- `claim_event`: `id`, `store_id`, `title` (1–80), `starts_at`, `ends_at` (later than start, at most 7 days long), `ended_at` (null unless ended early), `price_mode` (`market` or `custom`), `allow_unclaim` boolean, `pay_within_hours` (1–168, default 24), `max_per_buyer` (1–99, default 5), `created_at`.
- `claim_block`: `store_id`, `phone`, `email`, `created_at`, for the vendor's Block. A unique index on `store_id` where `ended_at is null` won't catch a timed end, so the one-at-a-time rule is enforced in the create action under the store lock.
- `claim_event_item`: `event_id`, `listing_id` (primary key on both), `price` (numeric, required when `price_mode = 'custom'`, checked in code), `max_per_buyer` integer, default 1.
- `request.claim_event_id` uuid, nullable, references `claim_event`. Unique indexes on (`claim_event_id`, `buyer_phone`), (`claim_event_id`, `buyer_email`) and (`claim_event_id`, `session_id`), where `claim_event_id` is not null. Claim requests are left out of the normal request queue.
- `request.last_claim_at` timestamp, for the once-a-second limit.
- `claimEventStatus`: a SQL expression in `src/lib/claim-events.ts`, next to the logic.

## Server logic (`src/lib/claim-events.ts`)

- `createEvent(db, storeId, input)`: locks the store, checks the store is online and has no other scheduled or live event, then checks each listing is the store's, active, priced (market mode) and in stock.
- `joinEvent(db, eventId, buyer, turnstileToken)`: verifies the token with Cloudflare, checks the block list and the IP cap, then inserts the claim request. Joining again from the same cookie returns the existing request.
- `claim(db, eventId, sessionId, listingId)`: a transaction that locks the buyer's joined request, then the store (share), the event row and the listing (`FOR UPDATE`). It checks that the status is `live`, the once-a-second limit, and the per-item and per-event caps, then `available = qty − all holds`. It upserts the line with the snapshotted price. It returns `{ ok }`, `{ taken }`, `{ notLive }` or `{ limit }`. It notifies `claim` and pushes to the vendor's phone on the buyer's first claim only.
- `unclaim(db, sessionId, eventId, listingId)`: only when `allow_unclaim` is on and the event is live. It deletes the line, and cancels the request when no lines are left.
- `eventStock(db, eventId)`: available per item, for the public endpoint.
- Exclusion: `listStock` and the storefront read leave out listings that are in an event which hasn't ended; `addToTableSale` and `insertRequest` treat them as taken. This is one shared SQL condition used in all three places.

## Screens

1. Dashboard → Events (`/dashboard/events`): the list, plus "New event" (title, start and end with `datetime-local`, converted with the browser's zone; price mode; unclaim switch; pay-within; then choose items from inventory, with a custom price per item when needed). The event page shows status, countdown, share link and copy-for-WhatsApp text, claims by buyer, and "End now".
2. Buyer event page `/[slug]/claim/[eventId]`: a countdown before the start, then the grid with "Claim" and "Claimed" per tile, a details sheet the first time, and a "Your claims" bar with a total and an unclaim option when allowed. After the end it shows "This event has ended", with the buyer's own claims and a note that the seller will message them on WhatsApp.
3. Store page: a banner for a scheduled or live event that links to the event page.
4. Help page: a "Claim events" topic, with screenshots from the help shots spec.

## Tasks (in order, each with its check)

1. Migration, schema and `claimEventStatus`. Check: drizzle drift check, plus a unit test for each status (scheduled, live, sold out, ended by time, ended early).
2. `createEvent`, `claim`, `unclaim`, `eventStock`. Check: unit tests for these cases:
   - two simultaneous claims on qty 1 give one `ok` and one `taken`
   - a claim before the start or after the end
   - a claim without a joined request is refused
   - the per-item and per-event caps, the once-a-second limit, the IP join cap, and a blocked number or email
   - an unclaim puts the unit back, and a sold-out event goes live again
   - a decline after the end puts the unit in the normal store
3. Exclusion from the store, cart and table sale, plus the delete and qty guards. Check: unit tests.
4. Dashboard create and manage screens, with the `claim` live event. Check: e2e.
5. Buyer event page, the public endpoint and the store banner. Check: e2e with two buyer contexts racing for the last unit at phone and desktop size, and an axe scan.
6. "Mark as paid" sends the receipt email to the outbox. Check: e2e.
7. Terms, help topic, handoff. Check: `CI=1` e2e on a production build.
8. Load check: about 200 parallel claims against a staging event. Check: no 5xx, and no item claimed beyond its qty.

## Risks to watch

- The rush at the start time: everyone refreshes the store page at once. If the staging load check shows strain, cache the event page's static parts.
- Someone with many real phone numbers and email addresses, on many IPs, can still get past the caps. Turnstile plus "Release all" and "Block" is the v1 answer; verifying numbers by OTP comes next if that happens.
- Turnstile needs `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` on Railway. The boot check (`env-check.ts`) refuses half a pair, and e2e uses Cloudflare's always-pass test keys.

## As built (2026-11-17)

- Logic in `src/lib/claim-events.ts`, tests in `src/lib/claim-events.test.ts`. The tests run on PGlite and, when `DATABASE_URL` is set (CI), on real Postgres, where 20 buyers on 3 units truly overlap.
- Screens: `/dashboard/events` (list, under More), `/dashboard/events/new`, `/dashboard/events/[id]` (share link, WhatsApp share, claims by buyer, Mark as paid, Release, Block, End now; refreshes on the store's live events). Buyer page `/[slug]/claim/[id]` with `claim-room.tsx`, polling `GET /api/claim/[id]` every 3 s while in view. The store page shows a banner linking to a scheduled or live event. `src/proxy.ts` 404s unknown event ids.
- Turnstile (`src/lib/turnstile.ts`): with no keys, joins pass off Railway and are refused on Railway. The boot check warns when both keys are unset and refuses half a pair. e2e blanks both keys rather than using Cloudflare's test keys.
- "Runs for" is a list (15 min to 7 days) rather than an end time, so the end can't come before the start.
- Event stock: `listStock(..., { forSale: true })` and `publicItemExists` leave out listings in an event that hasn't ended (`inOpenEvent` in `src/lib/listings.ts`), so the store page, item page, cart and table sale all skip them. Inventory tags them "In a claim event" and hides their Sell button.
- Not built, on purpose:
  - Guards on editing a listing mid-event. The app has no listing delete, and lowering qty below what's held is already allowed ("physical stock wins"). A hidden listing drops out of its event.
  - Editing an event. End it and make a new one.
  - Push or chime on a claim. The event page updates live; the queue and the "waiting" count leave claims out.
- A buyer marked paid mid-event who wants more joins again (new Turnstile check); their caps count every claim by that phone in the event.
- A local number (leading 0) takes the country code from the store's WhatsApp number when lengths match; otherwise the buyer is asked for the code.
- `TERMS_VERSION` is `2026-11-17`, with a "Claim events" section in the terms. `/help` has a Claim events topic (text only, no screenshot yet).
- Still to do: task 8 (about 200 parallel claims against a staging event), and the Turnstile keys on Railway.
