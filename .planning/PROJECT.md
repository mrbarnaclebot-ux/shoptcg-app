# shoptcg.app

Status: DRAFT, awaiting approval. No code until approved.

## What it does

A Pokemon TCG vendor creates a store, lists stock with live market pricing, and puts a QR code (later an NFC tag) on their table. Buyers scan it, browse prices, stock and price history on their phone, and send an "I'm interested" request. The seller is pinged instantly, both confirm at the table, and the seller gets a saved receipt while the buyer gets one by email.

## Problem today

Vendors at card shows price items with sticky labels or binders and check market prices on their own phone when buyers ask. Buyers flip through binders, ask "how much?" item by item, and have no idea whether prices are fair. Sales are tracked on paper or not at all.

## Who it is for

- For: hobby Pokemon vendors (the owner and a few friends) selling at local card shows, roughly 50 to 500 items each. Their buyers at the table.
- Not for: online marketplace sellers, shipping or fulfilment, game stores needing a full POS, other TCGs (v1), buyers who want accounts.

## Success criteria

- One week: a vendor can sign up, create a store, add 50 items in under 15 minutes, and open the store page from a printed QR code.
- One month: a vendor runs one full card show on it. Buyers scan, send requests, the seller confirms sales, receipts are emailed, and the end-of-show report matches the cash count.
- Done (v1): the above, plus nightly price sync running unattended for 30 days without manual fixes.
- Performance: the store page loads in under 2.5s (LCP) on a mid-range phone over slow 4G. The seller ping arrives within 3s of the buyer tapping send.

## Out of scope for v1

- Payments in-app (cash, card terminal or PayPal happen at the table; the method is recorded on the receipt)
- Camera card scanning (v2)
- Buyer accounts
- Multiple staff per store, trade-ins, shipping, other TCGs, subscription billing
- Automatic FX feeds (the vendor sets their own rate)

## Key decisions

| Decision | Choice | Reason |
| --- | --- | --- |
| Hosting | Railway, single Next.js service + Railway Postgres | Owner's choice. One bill, one deployable unit. |
| Language and framework | TypeScript, Next.js App Router | Server rendering for a fast public store page plus API routes in one app. |
| Database | Postgres (Railway) with Drizzle ORM | Constraints enforce stock integrity (stock never below 0, one active hold per unit). |
| Realtime seller ping | Postgres LISTEN/NOTIFY to Server-Sent Events, plus Web Push | No extra service. Web Push for when the seller app is in the background. |
| Scheduled jobs | Railway cron service running a sync script nightly, plus a 1-minute hold-expiry sweep | Built in on Railway. |
| Auth | Vendor-only, email magic link (Better Auth magic-link plugin + Resend; Auth.js is now maintained by Better Auth, who recommend it for new projects) | No passwords. Buyers never sign in. |
| Email | Resend (magic links, receipts, promos) | Simple API, good deliverability, free tier covers a hobby project. |
| Pricing data | PokemonPriceTracker API (primary; dev on Free/Pro, commercial use needs Business $99/mo, decided before first real show): raw, graded PSA/BGS/CGC/SGC, sealed, EN + JP. pokemontcg.io / TCGdex for images and metadata. JustTCG as a JP fallback. | TCGplayer API is closed to new developers. One provider covers all three product types. |
| Chinese products | Manual custom items, vendor sets the price | No reliable CN price source exists. |
| Currency | USD base. Vendor can show a second currency with their own typed-in FX rate. | Vendors use their own real-world rate, not Google's. |
| Vendor price | Store rule (e.g. market -10%, rounded to 0.50 or 1.00) plus per-item override. Recomputed nightly. | Vendors rarely sell at exactly market. |
| Holds | Soft hold, 15 min. Item shows "on hold" to others. Stock drops only when the seller confirms. | Stops two buyers fighting over the last copy. |
| Buyer info | Name + email upfront before sending a request. Receipt consent is implied by the request; promo opt-in is a separate unticked checkbox. | Owner's choice. Captures leads; consent stays explicit. |
| UI | Tailwind + shadcn/ui. Dark collector vault style: galaxy black primary, seal grey secondary, sunrise orange accent, holo shimmer used sparingly on card art, crisp tabular numerals for prices. | Owner's choice. Reads premium under show-hall lighting. |
| PWA | Seller dashboard installable (needed for iOS Web Push). | iOS only allows push from home-screen apps. |
| Package manager and tests | pnpm, Vitest, Playwright | Per agent.md. |
| Legal | Short T&C page + consent prompt before collecting buyer data | Per agent.md. |

## Data model (sketch)

- `vendor` (auth user) has one `store` (slug, name, logo, open/closed, price rule, rounding, second currency code + FX rate)
- `catalog_item` (provider id, kind raw|graded|sealed, language en|ja|zh, name, set, number, image, grader + grade)
- `price_point` (catalog_item, date, market_usd, source): daily snapshots, which gives us our own history
- `listing` (store, catalog_item or custom fields, condition, qty, override price, active)
- `request` (store, buyer name, email, promo opt-in, status pending|confirmed|declined|expired, expires_at)
- `request_line` (request, listing, qty, quoted price)
- `hold` (listing, request, qty, expires_at). The available quantity is qty minus active holds.
- `sale` + `sale_line` (final prices, discount, payment method, receipt number), immutable once saved
- `customer` (store, name, email, promo opt-in, unsubscribe token)

## Build steps (vertical slices, each one clickable)

1. Foundation. Next.js + Tailwind + shadcn scaffold, Railway service + Postgres, vendor magic-link sign-in, create store (name, slug, logo), T&C page, design tokens (the three brand colours), CI (lint, typecheck, Vitest, Playwright smoke), `scripts/` for setup, dev, test and deploy. Decisions: Drizzle migrations, Auth.js email provider, Railway auto-deploy from main via PR merges.
2. Catalog + price sync. PokemonPriceTracker client, search endpoint with a local cache, nightly cron that refreshes only items listed in some store and writes `price_point`. Decisions: a provider adapter (one implementation now, since a fallback provider is likely), and limits on how much we call the API.
3. Inventory. Search-and-add (name or number, pick language, condition or grade, qty), custom manual items (CN, odd slabs), CSV import with a preview and error rows, store pricing rule + per-item override, second-currency settings. Decisions: the CSV template columns, and how CSV rows are matched to catalog items.
4. Public store page + QR. `shoptcg.app/<slug>` with filters (raw/graded/sealed, EN/JP/CN, search), price in USD + second currency, stock left, price history chart, below-market badges, open/closed state (closed = browse-only), printable A5/A4 QR table sign. NFC: the same URL written to an NTAG215 tag, no code needed. Decisions: chart range (30/90 days), image optimisation.
5. Interest flow + seller ping. Buyer cart, name + email + consent form, request creates 15-min holds, seller receives it live (SSE + Web Push + sound), seller dashboard queue. Rate limiting per session and IP. Decisions: the hold-expiry sweep job, what buyers see while waiting.
6. Confirm sale + receipts. Seller edits line prices and discount, picks the payment method, confirms, stock is decremented in a transaction, an immutable receipt is saved, the receipt email goes to the buyer, and the buyer's screen updates to "confirmed". Decisions: receipt number format, email template.
7. Reports + customers. End-of-show report (date range, revenue, items, best sellers) with CSV export, a customer list of opted-in buyers, promo email export, an unsubscribe link. Decisions: whether promos are sent in-app or exported only (default: export only in v1).

## Risks and what would change course

- Price API accuracy or terms: if PokemonPriceTracker data is wrong or its terms forbid showing it publicly, switch to JustTCG/PriceCharting through the provider adapter. A test spike with real calls happens before step 2.
- iOS push needs home-screen install: if vendors skip it, the SSE + sound fallback still works while the dashboard is open. Onboarding nudges them to install.
- Venue WiFi: if pings are unreliable at real shows, add a "check requests" pull fallback and an offline sales log.
- Single Railway instance: LISTEN/NOTIFY + SSE assumes one instance. If we ever scale out, every instance listens to Postgres (still works) or we move to Redis pub/sub.
- Email deliverability: needs the SPF/DKIM DNS records on shoptcg.app for Resend. If the domain is not owned yet, use a Resend test domain until it is.
- Data entry friction: if adding 50 items takes over 15 minutes, camera scan moves up from v2.
