# Phase 6: Confirm sale + receipts

Branch `phase-6-sales`. Builds on phase 5 (`request`, `request_line`, `active_hold`, `live.ts`, waiting screen). Autonomous run: every decision below is final unless a check fails.

## Goal

At the table the seller opens a request, adjusts line prices, quantities and a discount, picks how the buyer paid, and confirms. In one transaction stock drops, holds release, an immutable sale with a receipt number is saved and the customer is recorded. The buyer's screen flips to "Sold. Enjoy your cards!" and a paper-ticket receipt email goes out (outbox in e2e, never real mail in tests).

## User stories

1. Seller: I see the buyer's code, lines and hold timer, can lower qty, change a price, remove a line, add a $ or % discount.
2. Seller: I must pick Cash, Card, Transfer or Other before the confirm button (which shows the total) enables.
3. Seller: confirm either fully succeeds or changes nothing; a double tap never makes two sales.
4. Seller: I see the receipt, can resend the email and copy its link; receipts cannot be edited.
5. Buyer: my waiting screen turns into the receipt with a celebration, and the receipt arrives by email.
6. Buyer: if I opted in to promos I am on the seller's list with an unsubscribe link that works without signing in.

## Decisions (default and why)

| Topic | Decision | Why |
| --- | --- | --- |
| Money | Integer cents in app code (`src/lib/money.ts`: `toCents`, `fromCents`); `numeric(12,2)` in DB. Discount `%` rounds half up to the cent, applied to subtotal. Total >= 0; discount <= subtotal. | Same exact-math rule as `vendorPrice`. |
| Line edits | Qty 1..requested (can only go down), unit price 0.00..99999.99 (0 allowed for a throw-in), remove line (at least one line must remain, else use Decline). | SCREENS 9; seller never adds unrequested items in v1 (YAGNI). |
| Payment method | `cash`, `card`, `transfer`, `other`; `other` requires a note 1..40 chars. Labels: Cash, Card, Transfer (PayPal, bank), Other. | Owner list; PayPal fits Transfer. |
| Hold expired | Confirm allowed for `pending` or `expired` requests if stock still covers each line (SCREENS 9 banner). `declined` / `cancelled` / `confirmed` refuse. | The buyer is standing at the table. |
| Transaction | `confirmSale`: lock request `for update` (scoped to `store_id`), lock listings ordered by id `for update`, check `qty >= line qty`, `update listing set qty = qty - n`, bump `store.receipt_seq` (row lock serialises numbering), insert `sale` + `sale_line`, set request `confirmed` (releases holds through the view), upsert `customer`, `pg_notify` confirmed. Any failure rolls back everything. | Spec: stock decrements only at confirm; DB `listing_qty_nonneg` is the final backstop. |
| Idempotency | `unique(sale.request_id)`. A second confirm for a confirmed request returns the existing sale id (no error). | Double tap on hall WiFi. |
| Immutability | `BEFORE UPDATE` trigger on `sale` and `sale_line` raises `P0001 'sale_immutable'`. Deletes allowed only through store cascade (account deletion). `sale_line` stores a snapshot (name, set, number, grade label, language, image URL, unit price, qty, market at sale) and `listing_id` as a plain uuid without FK, so no cascade can ever update it. Email delivery state lives in a separate mutable `receipt_email` table. | Receipts must match the cash count forever. |
| Receipt number | Per-store sequence: `R-` + `lpad(seq, 4, '0')` (R-0001 ... R-9999, then R-10000 naturally). `unique(store_id, seq)`. | SCREENS format, short to read aloud, no global counter leaks volume across stores. |
| FX snapshot | `sale.second_currency` + `sale.fx_rate` copied at confirm; receipt shows the approx line with the rate. | Vendor may change the rate later. |
| Customer upsert | Not for `is_test` requests. Key `(store_id, email)` (email already lowercased). Name updated to latest. `promo_opt_in`: request ticked -> true and `opted_in_at = now()`, `opted_out_at = null`; unticked -> keep existing (an unticked box is not a withdrawal). Token `unsubscribe_token` = 32 random bytes base64url, created once. | Explicit consent per request; one record per buyer per store. |
| Email | `sendReceiptEmail` in `src/lib/email.ts` via the same plain `fetch` to Resend. Sent in `after()` once the transaction commits; result written to `receipt_email` (`sent` / `failed` + error text truncated 200 chars). Subject "Your receipt from [Store] ([R-0042])", preheader "Your receipt from [Store], [$80.00].", HTML + plain text. | Sale save never waits on email; email retryable. |
| Template | `src/lib/receipt-email.ts`: hand-written 600 px table HTML, inline styles, paper background `#F4EFE6` (paper token as hex for email clients), galaxy ink, 4 px orange rule, perforation as a dashed border, stub row with receipt no. and payment method, store name in Big Shoulders with `Arial Narrow, Arial` fallback, 48 px thumbnails with alt = card name. Every interpolated string HTML-escaped by one `esc()` helper. Footer: "You got this because you bought from [Store] on shoptcg.app." + if opted in "You're on [Store]'s update list. Unsubscribe." No tracking pixels, no remote fonts. | No React Email dependency for one template. |
| Test sender limit | Until shoptcg.app DNS (SPF/DKIM) is verified in Resend, `onboarding@resend.dev` only delivers to the Resend account owner's address; other buyers' receipts fail -> `receipt_email.failed` -> toast #21 "Resend". Documented in the deploy checklist. | Known Resend restriction. |
| Outbox | When `MAGIC_LINK_OUTBOX` is set (e2e), append `<to> receipt:<R-0042> <unsubscribeUrl or ->` and never call Resend. Same deployed-env guard as today. | Reuses the existing outbox and its safety check. |
| Receipt links | Seller: `/dashboard/sales/[id]` (store-scoped). Buyer: their `/[slug]/request/[id]` page becomes the receipt view (cookie-scoped). [Copy link] copies the buyer URL only for the seller to resend context; it is useless without the buyer cookie, so the email body carries the full receipt instead of a link. | No public receipt URL means no receipt IDOR surface. |
| Unsubscribe | `/u/[token]`: GET renders a page with [Unsubscribe] (POST form) so link scanners cannot unsubscribe by prefetch; POST sets `promo_opt_in = false`, `opted_out_at = now()`, shows "You're off [Store]'s list." Plus RFC 8058 `POST /api/unsubscribe?t=` accepting `List-Unsubscribe=One-Click` for mail clients; receipt email carries `List-Unsubscribe` + `List-Unsubscribe-Post` headers only when opted in. Unknown token: same success copy (no token oracle). | Works without login, safe against prefetch. |
| Celebration | Show floor equivalent of the old booster rip: on the buyer's confirmed screen the receipt ticket "punches" (stub perforation tears, 360 ms) and a rubber stamp "SOLD" lands 3 degrees off true (220 ms scale 1.15 -> 1, one time). Seller gets toast #19 promise (loading "Recording", success "Sale R-0042 recorded" / "$80.00 cash. Receipt sent to maya@...") with a CSS stamp on the toast. Reduced motion: stamp appears without scale, no tear. CSS keyframes only, no new library. Reuse `src/components/show-moment.tsx`, `stamp.tsx` and `ticket.tsx` (being built for the landing / store-created moment). | UI-SPEC: celebrations become ticket punch / stamp. |
| Watermelon Send Money | Not installed; motion reference only (PERSONALITY says heavy). | 75 hard-coded colours, blur. |

## Schema changes (migration `0010_sales.sql`)

- `store.receipt_seq integer not null default 0`.
- `sale`: `id uuid pk`, `store_id fk store cascade`, `request_id uuid not null unique fk request`, `seq integer not null`, `receipt_no text not null`, `buyer_name text not null`, `buyer_email text not null`, `subtotal numeric(12,2)`, `discount numeric(12,2) not null default 0`, `discount_kind text` check in (`amount`,`percent`) or null, `discount_pct numeric(5,2)` (0..100), `total numeric(12,2)`, `payment_method text not null` check in (`cash`,`card`,`transfer`,`other`), `payment_note text` (required iff other), `second_currency text`, `fx_rate numeric`, `created_at timestamptz default now()`. Checks: `total = subtotal - discount`, `discount between 0 and subtotal`, `total >= 0`. `unique(store_id, seq)`, index `(store_id, created_at)`.
- `sale_line`: `sale_id fk sale cascade`, `line_no smallint`, `listing_id uuid` (no FK), `catalog_item_id uuid` (no FK), `name`, `set_name`, `number`, `grade_label`, `language`, `image_url`, `qty integer check 1..99`, `unit_price numeric(12,2) check >= 0`, `quoted_price numeric(12,2)`, `market_usd numeric(12,2)`; pk `(sale_id, line_no)`.
- Trigger `forbid_update()` on `sale`, `sale_line`.
- `receipt_email`: `sale_id pk fk sale cascade`, `status text check in (pending, sent, failed)`, `attempts int default 0`, `last_error text`, `updated_at`.
- `customer`: `id uuid pk`, `store_id fk store cascade`, `email text not null`, `name text not null`, `promo_opt_in boolean not null default false`, `opted_in_at`, `opted_out_at`, `unsubscribe_token text not null unique`, `first_purchase_at`, `last_purchase_at`, `purchases integer default 1`; `unique(store_id, email)`, check `email = lower(email)`.

## Server actions and routes

| Name | File | Auth | Validation | Effect |
| --- | --- | --- | --- | --- |
| `confirmSale(input)` | `src/app/dashboard/requests/[id]/actions.ts` | `requireStore()`; request must be this store's | zod: `requestId` uuid, `lines` 1..30 `{listingId uuid, qty int 1..99, unitPrice string ^\d{1,5}(\.\d{1,2})?$}` each a subset of the request's lines with qty <= requested, `discount` `{kind: none/amount/percent, value}`, `method` enum, `note` 1..40 if other | tx above; `after()` send email; returns `{ok, saleId, receiptNo}` or `{stock: listingId[]}` or `{gone}` |
| `resendReceipt(saleId)` | `src/app/dashboard/sales/actions.ts` | `requireStore()`, sale in store | uuid; max 5 attempts per sale | send again, update `receipt_email` |
| `unsubscribe(token)` | `src/app/u/[token]/actions.ts` | none | token `^[A-Za-z0-9_-]{43}$` | opt out |
| `POST /api/unsubscribe` | route handler | none | `t` param as above, body `List-Unsubscribe=One-Click` | opt out, 200 |

Pure logic `src/lib/sales.ts` (`priceSale(lines, discount)` -> cents totals; `confirmSale(db, storeId, input)`), unit-tested.

## UI screens and states

1. `/dashboard/requests/[id]` (full screen mobile, side panel desktop): header "Sale for Maya R.", code chip matching the buyer's stub, hold timer; lines on a paper ticket with qty stepper (down only), price input (`inputmode=decimal`, tabular), "was $48.00" struck when changed, remove; discount segment None / $ / % + input, "Discount -$6.00"; payment segment buttons 48 px; summary Subtotal / Discount / Total (Big Shoulders); approx line; primary ticket button "Confirm sale, $80.00" disabled with helper "Pick how they paid."; [Decline request] destructive text with inline confirm (phase 5 action).
   States: hold expired banner "The hold ended, but nothing has sold. You can still confirm if the items are here."; stock gone -> line "No longer in stock", confirm disabled until removed; confirm failed -> inline "Sale not saved. Nothing was charged or changed. [Try again]" + toast #26; already confirmed -> redirect to the sale; declined/cancelled -> "This request was closed." + back.
2. `/dashboard/sales/[id]` receipt: store name + logo, "Receipt R-0042", local date/time (vendor tz cookie from phase 7, UTC fallback), "Paid by Cash", lines table, subtotal / discount / total, approx line with rate, email status line ("Emailed to maya@..." / "Email didn't send. [Resend]"), [Copy link], note "Receipts can't be changed once saved." Toasts #20 on resend, #21 on failure, #27 on copy.
3. `/dashboard/sales`: replace placeholder with today's sales list (time, first name, items, total, method, receipt link) and empty state from the placeholder copy; full reporting is phase 7.
4. Buyer `/[slug]/request/[id]` confirmed: "Sold. Enjoy your cards!" (the one exclamation mark), punched ticket + SOLD stamp, receipt summary with receipt no. and method, "Your receipt is on its way to [email].", [Back to store].
5. `/u/[token]` paper card: "Stop emails from [Store]?" [Unsubscribe]; after: "You're off [Store]'s list. You'll still get receipts for things you buy."
6. Dashboard queue ticket of a confirmed request leaves the queue; "Today: 6 sales, $412.50" line under the queue.

## Security notes

- IDOR: sale, request and listing reads all carry `store_id = myStore.id`; buyer view needs the cookie. Line ids must be a subset of the request's lines (no adding someone else's listing).
- Price and discount bounds enforced server side; totals recomputed server side, client total ignored.
- Email HTML escaping on every field (buyer name is attacker controlled). Header injection: subject built from store name with CR/LF stripped.
- Unsubscribe tokens are 256-bit random, compared via indexed lookup; responses identical for unknown tokens; POST only.
- PII: buyer email on the receipt only for the owning seller. Logs print sale id, never email.
- Resend key server only; outbox guard refuses on deployed envs (existing `outboxPath`).

## Performance budget

- `confirmSale` < 200 ms p95 with 30 lines (excluding email).
- Buyer screen flips to confirmed within 3 s of seller confirm (SSE from phase 5).
- Celebration: transform/opacity only, 60 fps on mid-range Android; no layout animation.
- Email HTML < 40 KB.

## Tasks (in order, each with its check)

1. `money.ts` + `priceSale` Vitest (percent rounding, discount > subtotal refused, zero-price line). Check: `pnpm test src/lib/money.test.ts src/lib/sales.test.ts`.
2. Schema + triggers + `0010`. Check: migrate; Vitest that `update sale set total = 0` raises `sale_immutable`.
3. `confirmSale` DB function. Vitest: stock decremented, holds released (available back), receipt numbers sequential per store and independent across stores, second call returns same sale, insufficient stock rolls back with no qty change, test requests create no customer.
4. Customer upsert rules. Vitest: tick -> opted in; later untick keeps opt-in; unsubscribe then tick again re-opts in with new `opted_in_at`.
5. Receipt email template + `esc()` + outbox line. Vitest: `<script>` in buyer name is escaped; unsubscribe link only when opted in; plain text part present.
6. `after()` email send + `receipt_email` status + resend action with attempt cap. Vitest with a fake fetch returning 403 -> `failed`.
7. Confirm screen UI + action. Check: e2e confirm path.
8. Receipt page + sales list replacement. Check: e2e receipt shows R-0001 and "Paid by Cash".
9. Buyer confirmed screen + celebration CSS with reduced-motion branch. Check: e2e with `reducedMotion: 'reduce'` still shows the stamp text.
10. Unsubscribe page + one-click route. Check: e2e unsubscribe via outbox URL; Vitest one-click POST.

## Playwright e2e (`e2e/sales.spec.ts`)

- Full table sale: vendor + buyer contexts; buyer requests 2 items (ticks promos); seller opens request, lowers one price, adds 10 % discount, picks Cash, confirms; toast "Sale R-0001 recorded"; inventory qty dropped; buyer screen shows "Sold. Enjoy your cards!" within 3 s; outbox has `buyer@... receipt:R-0001 https://.../u/...`.
- Double submit: two rapid clicks on confirm -> one sale in the sales list.
- Payment required: confirm disabled until a method is chosen; Other requires a note.
- Expired hold still confirmable while stock exists; after another sale empties stock, line shows "No longer in stock".
- Email failure: env `RECEIPT_EMAIL_FAIL=1` (test-only, refused when deployed) -> receipt shows "Email didn't send" and Resend works after unsetting via the action's retry.
- Unsubscribe: open the outbox URL, press Unsubscribe, see confirmation; customer no longer opted in (checked in phase 7 list).
- IDOR: vendor 2 visiting vendor 1's `/dashboard/sales/<id>` gets 404.

## Definition of done

- All checks pass; CI green.
- Sale and sale_line provably immutable (trigger test); stock never negative under concurrent confirms (Vitest on CI Postgres).
- Receipt email renders in Gmail web and iOS Mail from a real send to the owner's address (Resend test sender), screenshot in PR.
- No real email sent from any automated test (outbox only).
- Shots of confirm, receipt, buyer confirmed at 390 / 768 / 1280 in `phases/06-sales/shots/`.
