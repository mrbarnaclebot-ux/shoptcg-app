# Phase 5: Interest flow + seller ping

Branch `phase-5-requests`. Builds on phase 4 (`storefront.ts`, list island, `heldByListing` stub). Autonomous run: every decision below is final unless a check fails.

## Goal

A buyer sends their list with name + email; the items are soft-held for 15 minutes so `available = qty - active holds` can never go below zero; the seller is pinged within 3 s (SSE + sound in the open dashboard, Web Push when backgrounded); the buyer watches live status on a waiting screen; the seller can decline.

## User stories

1. Buyer: I review my list, enter my name and email, optionally tick promos, read the consent line, and send.
2. Buyer: if an item was just taken, I see which line and can send without it.
3. Buyer: I see a countdown, a 4-character code to show the seller, and live status (waiting, confirmed, declined, expired). I can cancel.
4. Seller: my phone chimes and the request appears at the top of the queue within 3 s, even with the dashboard backgrounded (installed PWA).
5. Seller: I decline a request and the items go back on sale immediately.
6. Everyone: two buyers can never hold the last copy at the same time.

## Decisions (default and why)

| Topic | Decision | Why |
| --- | --- | --- |
| Buyer identity | Random 128-bit `buyer_sid` cookie (httpOnly, Secure in prod, SameSite=Lax, 30 days), set by the send action. No account. | Ties the waiting screen, rate limits and cancel to one phone. |
| List storage | Stays in `localStorage["list:<slug>"]` (phase 4); posted as `[{listingId, qty}]` on send. No server cart table. | Nothing to persist server side until the request exists. SCREENS: list persists 24 h per store. |
| Prices | Server recomputes every quoted price with `vendorPrice` inside the transaction; client totals are display only. | Never trust client prices. |
| Hold model | `request` + `request_line` tables. `hold` is a **view** (`active_hold`) over `request_line` joined to `request` where `status = 'pending' and expires_at > now()`. | Spec names a hold; a view keeps one source of truth, so release is a single status UPDATE and orphan holds are impossible. |
| No oversell | Send runs in one transaction: `select ... from listing where id = any($ids) and store_id = $s order by id for update` (ordered locks avoid deadlocks), compute held per listing from `active_hold`, reject lines where `qty_requested > qty - held`, insert. Backstop: `BEFORE INSERT` trigger `request_line_capacity` locks the listing row and raises `P0001 'hold_exceeds_stock'` if the line would overdraw. | App check reports every failing line for the "Just taken" UI; the trigger guarantees the rule for any code path. |
| Vendor qty edits | Allowed below the held amount (physical stock wins); available displays as `max(0, ...)`. Confirm (phase 6) rechecks qty. | The table is the truth. |
| Expiry | **Lazy expiry on read** + an in-process 60 s sweeper. Availability and status reads treat `pending and expires_at <= now()` as expired, so correctness never depends on a job. The sweeper (`setInterval` started in `instrumentation.ts`, nodejs runtime, not during build, `unref()`) flips those rows to `expired` and NOTIFYs so open screens update. No Railway cron for holds. | Railway cron jobs cannot run more often than every 5 minutes, which would leave holds up to 20 min. Single instance, so one in-process timer is enough; a second instance would only do redundant idempotent UPDATEs. |
| Realtime | Postgres `LISTEN live` / `pg_notify('live', json)` called **inside** the transaction (delivered on commit, never for a rolled-back request). Payload ids only: `{"s":storeId,"r":requestId,"t":"new|expired|declined|cancelled|confirmed"}`. One process-wide listener in `src/lib/live.ts` using `db.$client.listen(channel, cb)` (same signature on postgres-js and PGlite), fanned out via an in-memory `EventTarget` keyed by store id and request id. | Spec choice; commit ordering for free; works from the sweeper and any future script. |
| SSE | Route handlers: `GET /api/live/store` (vendor session, own store only) and `GET /api/live/request/[id]` (buyer cookie must equal `request.session_id`, else 404). `text/event-stream`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`, `retry: 3000`, `: ping` comment every 20 s, server closes after 5 min so proxies never time out mid-stream; `EventSource` reconnects. Events carry type only; the client calls `router.refresh()` to re-render server data. | No client state duplication; reconnect is built into EventSource. |
| Fallbacks | Buyer: on EventSource error, poll `router.refresh()` every 10 s. Seller: header indicator Live / Reconnecting / Offline, plus a [Check for requests] button (toast #25 action also exists on page). | SCREENS + PROJECT risk "venue WiFi". |
| Web Push | `web-push` library (crypto done right; do not hand-roll aes128gcm). VAPID keys generated once with `pnpm dlx web-push generate-vapid-keys`, set as `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:owner@...`. Public key passed to the client as a server component prop (no `NEXT_PUBLIC_`, so no rebuild to rotate). Sent in `after()` post-commit, TTL 900, urgency high, `tag` = request id. 404/410 deletes the subscription. Unset keys: push silently disabled (dev, e2e). | iOS needs installed PWA; push is additive to SSE. |
| PWA | `src/app/manifest.ts` (name, `start_url: /dashboard`, `display: standalone`, galaxy black theme), icons via `src/app/icon.tsx` + `apple-icon.tsx` (`ImageResponse`, wordmark on black), `public/sw.js` (push -> `showNotification`, `notificationclick` -> focus or open `/dashboard?r=<id>`). SW registered only inside the dashboard. | Next file conventions, no asset pipeline. |
| Sound | WebAudio two-tone chime (oscillator, 2 x 120 ms), unlocked by the "Sound on" toggle click (stored in localStorage), plus `navigator.vibrate([80,60,80])`. "Test alert" plays it and sends a test push. | No audio asset; autoplay rules need a gesture. |
| Request code | 4 chars from `23456789ABCDEFGHJKMNPQRSTVWXYZ`, unique per store among pending requests (partial unique index); retry up to 5 times on 23505. | Readable across a table; collisions only matter while pending. |
| Rate limits | Count `request` rows, no new table: per `buyer_sid` 3 per 10 min and at most 2 pending per store; per IP 30 per 10 min (venue WiFi is one NAT). IP stored as `HMAC-SHA256(BETTER_AUTH_SECRET, ip)` via existing `clientIp()`. Max 30 lines, qty 1 to 99 per line. | Same pattern as `sign-in-limit.ts`; no raw IPs at rest. |
| Seller queue UI | Plain server-rendered list on `/dashboard` (Requests tab), paper request tickets with stub (table, hold timer, code, No.). "Expired today (3)" group is a native `<details>`; Watermelon List Stack is skipped. | List Stack lacks reduced-motion and aria; `<details>` is accessible and zero JS. |
| Decline | Inline confirm on the ticket ("Decline and release items?" [Decline] [Keep]), server action sets `status = 'declined'`. No undo. | Release must be immediate so other buyers see stock. |
| Buyer cancel | [Cancel request] with inline confirm sets `cancelled`. | SCREENS 8. |
| Test request | Seller [Send a test request] creates `is_test = true` request with up to 2 of their own in-stock listings and buyer "Test buyer"; it holds stock like a real one for 15 min (so rehearsal is honest); excluded from customers and reports. | SCREENS 4a. |
| PII retention | Sweeper also nulls `buyer_name`, `buyer_email`, `ip_hash` on non-confirmed requests older than 30 days. | Collect only what a sale needs; documented in Terms. |
| Terms | Add consent version constant `TERMS_VERSION = '2026-11'` stored on each request; Terms page gains a "Buyer requests" paragraph (what is shared, 30-day deletion of unsold requests, promo opt-in). | Consent must be provable. |

## Schema changes (migration `0009_requests.sql`)

- `request`: `id uuid pk`, `store_id uuid not null fk store on delete cascade`, `code text not null`, `status text not null default 'pending'` check in (`pending`,`confirmed`,`declined`,`expired`,`cancelled`), `buyer_name text` (1..80 when not null), `buyer_email text` (<= 254, lowercased), `promo_opt_in boolean not null default false`, `terms_version text not null`, `consented_at timestamptz not null default now()`, `session_id text not null`, `ip_hash text`, `is_test boolean not null default false`, `expires_at timestamptz not null`, `created_at timestamptz not null default now()`, `decided_at timestamptz`. Checks: `code ~ '^[2-9A-HJKMNP-TV-Z]{4}$'`, `expires_at > created_at`.
- Indexes: unique `request_pending_code_idx (store_id, code) where status = 'pending'`; `request_store_created_idx (store_id, created_at desc)`; `request_session_idx (session_id, created_at)`; `request_ip_idx (ip_hash, created_at)`; `request_pending_expiry_idx (expires_at) where status = 'pending'`.
- `request_line`: `request_id uuid fk request on delete cascade`, `listing_id uuid not null fk listing`, `qty integer not null check 1..99`, `quoted_price numeric(12,2) not null check >= 0`, pk `(request_id, listing_id)`, index `(listing_id)`.
- View `active_hold`: `select rl.listing_id, rl.request_id, rl.qty, r.expires_at from request_line rl join request r on r.id = rl.request_id where r.status = 'pending' and r.expires_at > now()` (Drizzle `pgView(...).as(sql)`; hand-edit the migration if drizzle-kit cannot emit it).
- Trigger function `request_line_capacity()` (plpgsql) + `BEFORE INSERT` trigger as described. Vitest proves PGlite runs it.
- `push_subscription`: `endpoint text pk`, `user_id text not null fk user on delete cascade`, `p256dh text not null`, `auth text not null`, `created_at`.

`heldByListing` (phase 4 stub) now reads `active_hold` grouped by listing, plus `min(expires_at)` for "Back in about N min".

## Server actions and routes

| Name | File | Auth | Validation | Effect |
| --- | --- | --- | --- | --- |
| `sendRequest(slug, form)` | `src/app/[slug]/list/actions.ts` | none; sets `buyer_sid` | zod: `name` trim 1..80, `email` `z.email()` <= 254 lowercased, `promo` checkbox (default false), `lines` JSON 1..30 of `{listingId: uuid, qty: 1..99}` deduped | rate limit -> tx (store open check `for share`, lock listings, availability, insert request + lines, `pg_notify`) -> `after()` push. Returns `{ok, id}` / `{fieldErrors}` / `{taken: listingId[]}` / `{closed}` / `{limited}` |
| `cancelRequest(id)` | same | cookie must match | uuid | pending -> cancelled, notify |
| `declineRequest(id)` | `src/app/dashboard/requests/actions.ts` | `requireStore()`, `request.store_id = store.id` | uuid | pending/expired -> declined, notify |
| `sendTestRequest()` | same | `requireStore()` | none | creates `is_test` request |
| `savePushSubscription(sub)` / `removePushSubscription(endpoint)` | `src/app/dashboard/push-actions.ts` | `requireUser()` | endpoint https URL <= 2048, keys base64url <= 200 | upsert/delete by endpoint (re-owned to the current user) |
| `GET /api/live/store` | route handler | vendor session | none | SSE for own store |
| `GET /api/live/request/[id]` | route handler | `buyer_sid` = `session_id` | uuid | SSE for that request |

Core logic lives in `src/lib/requests.ts` (pure DB functions taking `db`, unit-tested on PGlite); actions are thin.

## UI screens and states

1. `/[slug]/list` (bottom sheet on mobile via a full route with `paper` sheet styling; right panel at desktop): lines with stepper (max = available), remove, "Total at the table", note "The seller may adjust prices or add a discount when you meet.", form fields + unticked promo box "Email me when [Store] has new stock or deals. Unsubscribe any time.", consent line "By sending, you share your name and email with [Store] for this request and your receipt. See Terms.", primary ticket button [Send to seller] (label "Sending" while pending), sub "Items are held for you for 15 minutes." Errors per SCREENS 7: inline field errors with focus to first; taken lines "Just taken by another buyer", qty 0, button "Send without it"; closed; rate limited; network ("Couldn't send... List is kept."). Empty list copy.
2. `/[slug]/request/[id]` waiting (this route mounts `ToastRoot`, the only buyer route with Sileo): request ticket on paper with tear-off stub: "Sent to [Store]", hold countdown "Held for 14:32" (orange; under 3 min warning copy with table number), code box "Show the seller this code", read-only lines, [Cancel request]. Toasts: #14 success on arrival, #16 at 3 min left, #17 buyer warning with [Send again] (also a page button that rebuilds the list from what is still available), #18 info [Back to the table]. Confirmed state is phase 6 (shows "Confirmed" placeholder until then). 404 if cookie does not match.
3. `/dashboard` queue: install nudge (once per day, iOS 3-step inline guide), alerts row (Sound on, Test alert), request tickets newest first (name, "just now", hold timer, lines, total, [Decline] secondary, [Review sale] primary ticket -> phase 6 route), new arrival gets "New" label + orange outline pulse twice (CSS, off under reduced motion), document title "(1) Requests". Expired group `<details>` "Hold ended. Items are back in stock." Empty / loading / error per SCREENS 4a. Toast #15 action "Review" (same button on the ticket), #17 seller info, #25 on SSE drop.
4. Store page: tiles now show "On hold" hatch and "Back in about N min"; detail page on-hold copy.

## Security notes

- IDOR: every request read/write is scoped by `store_id = myStore.id` (seller) or `session_id = buyer_sid` (buyer). Request ids are uuids but are never the only check.
- Listings in a request must belong to the slug's store and be `active` (checked in the locked select).
- Rate limits above; the action returns the SCREENS copy, never the counts.
- PII: buyer email only shown to the owning seller. Push payload uses "Maya R." (first name + initial), no email. Logs never print name/email (log request id). IP stored only as HMAC. 30-day purge.
- Consent: promo box unticked by default and stored separately from receipt consent; `terms_version` + `consented_at` stored.
- CSRF: server actions have Next origin checks; SSE routes are GET and read-only.
- SSE connection cap: max 3 open streams per buyer cookie and 5 per vendor (in-memory counter) to stop a tab-spam DoS.

## Performance budget

- Seller ping: buyer tap to queue row visible <= 3 s (asserted in e2e with a 3000 ms expect timeout).
- `sendRequest` server time < 150 ms p95 with 30 lines.
- Waiting route JS: Sileo + motion allowed here only; <= 110 KB gzipped beyond framework.
- Listener: one Postgres connection for LISTEN total, not per stream.

## Tasks (in order, each with its check)

1. Schema + view + trigger, generate `0009`, hand-edit for view/trigger if needed. Check: `pnpm db:migrate`; Vitest inserts an over-capacity line directly and expects `hold_exceeds_stock`.
2. `requests.ts`: `createRequest` with locks and availability. Vitest: two concurrent `createRequest` for the last copy (`Promise.all` on postgres via `DATABASE_URL` in CI, PGlite serialises) -> exactly one succeeds; taken lines reported; closed store rejected; prices recomputed server side.
3. Rate limits + IP HMAC. Vitest: 4th request in 10 min refused; 31st per IP refused.
4. Lazy expiry in `heldByListing` and status reads + sweeper (`sweepRequests(db)` pure function, timer in `instrumentation.ts`) + 30-day purge. Vitest with fake `now()` via an inserted past `expires_at`.
5. `live.ts` listener + notify helper. Vitest on PGlite: notify in a committed tx is received; in a rolled-back tx is not.
6. SSE routes with auth. Check: `curl -N` on dev with a buyer cookie streams `: ping`; wrong cookie 404.
7. `/[slug]/list` page + `sendRequest` action. Check: e2e send happy path lands on waiting page.
8. Waiting page with countdown, code, cancel, SSE refresh, poll fallback. Check: e2e cancel releases stock on store page.
9. Seller queue on `/dashboard` + decline + test request + document title count. Check: e2e decline flips buyer screen to declined copy.
10. Sound, vibrate, alerts row. Check: unit test for the chime scheduler is skipped (trivial); manual check noted in PR.
11. PWA manifest, icons, `sw.js`, push subscribe + `web-push` send + 410 cleanup. Vitest for the cleanup with a fake sender; manual iOS check by owner.
12. Store page hold states. Check: e2e second buyer sees "On hold" on the last copy.
13. Terms paragraph + `TERMS_VERSION`. Check: e2e Terms page contains "Buyer requests".

## Playwright e2e (`e2e/requests.spec.ts`)

Two browser contexts (vendor signed in via outbox, buyer anonymous), push disabled (no VAPID env).
- Happy path: buyer adds 2 items, sends; seller queue shows the ticket within 3000 ms with matching code; buyer sees countdown and code.
- Last copy race: buyer A holds the last copy; buyer B's tile shows "On hold"; B's stale list shows "Just taken by another buyer" and "Send without it".
- Decline: seller declines; buyer sees "The seller couldn't do this one."; store shows the item available again.
- Cancel: buyer cancels; seller ticket disappears.
- Expiry: test-only env `HOLD_MINUTES=0.05` (3 s, refused when deployed like `MAGIC_LINK_OUTBOX`) -> buyer sees "Your hold ended.", seller expired group count 1.
- Validation: empty name and bad email show inline errors and focus the name field.
- Rate limit: 4 sends from one context in a row -> "Too many requests from this phone."
- IDOR: buyer B opening buyer A's `/request/<id>` gets 404; vendor of store 2 cannot decline store 1's request (action returns not found).
- Closed store: no list bar; posting a stale list returns the closed copy.

## Definition of done

- All checks pass; CI green (`lint`, `typecheck`, `test`, `e2e`).
- Concurrency test proves no oversell on real Postgres in CI.
- Seller ping under 3 s in e2e; push received on the owner's installed iPhone and Android (PR note).
- No raw IP, no buyer email in logs (grep the dev log after an e2e run).
- Terms updated; consent version stored on every request.
