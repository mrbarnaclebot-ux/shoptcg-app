# Phase 4: Public store page + QR table sign

Branch `phase-4-store-page`. Builds on phase 3 (`listing`, `vendorPrice`, `listStock`) and the Show floor direction (`design/variations/v3-showfloor/`). Autonomous run: every decision below is final unless a check fails.

## Goal

A buyer scans the table sign and in under 2.5 s (LCP, mid-range phone, slow 4G) sees the vendor's stock: price in USD plus the vendor's second currency, stock left, an under-market stamp, on-hold state, filters, and a detail page with price history. A vendor prints an A5 or A4 sign with a scannable QR.

## User stories

1. Buyer: I scan the QR and see what is on the table with prices I can trust.
2. Buyer: I filter Raw / Graded / Sealed and EN / JP / CN, or search a name or card number.
3. Buyer: I open an item and see its market history over 30 or 90 days next to this table's price.
4. Buyer: when the store is closed I can still browse, but nothing invites me to request.
5. Buyer: a mistyped link gives a real "store not found" page (HTTP 404).
6. Vendor: I print a sign at A5 or A4 that scans first time, shows my table number, and the NFC line only if I have a tag.

## Decisions (default and why)

| Topic | Decision | Why |
| --- | --- | --- |
| Rendering | `/[slug]` stays dynamic, server rendered. `export const instant = false`; await params, validate slug, look up the store, `notFound()` **before** any Suspense boundary. Header renders in the first flush; grid streams in one `<Suspense>` with 6 skeleton tiles. | Next 16 docs (`02-guides/streaming.md`, "Status codes"): notFound after streaming starts keeps 200 + noindex. Fixes the soft-404 ponytail in `src/app/[slug]/page.tsx`. |
| Data cache | None for store or stock. Price history is a `'use cache'` function with `cacheLife('hours')`, keyed by `(catalogItemId, range, utcDate)`. | Holds change by the minute, so any stock cache is wrong. One indexed query for 500 rows is ~5 ms. History changes once a day; the date in the key rolls it over without needing the cron process to call `revalidateTag` (it cannot, it is a separate process). |
| Filters | URL search params (`?type=raw&lang=ja&lang=zh&q=zard&sort=price-desc`), chips are `<Link>`s with `aria-pressed`, search is a GET `<form>`. | Works with zero JS, shareable, server filters with the existing `filterConds`. No Continuous Tabs (needs motion). |
| JS budget | One client island `list-island.tsx`: add buttons, list bar, `localStorage` list. No Sileo, no motion, no Base UI on `/[slug]` and `/[slug]/item/[id]`. `ToastRoot` stays out of the public layout. | Hits LCP and keeps the buyer bundle small. Toasts start in phase 5 on the request route. |
| Currency | USD primary, second line "approx. A$64" when the store has a second currency. No toggle. Footnote once at the end of the grid with the rate. | SCREENS shows both; a toggle adds JS and a remembered setting for no gain. |
| Under-market stamp | Shown when the listing has a market price and vendor price <= 95 % of market. Copy `floor(100 - price/market*100)`% "under market". Never "above market". Custom items without market: no stamp, no market line. | SCREENS rule. Integer cents math from `vendorPrice`. |
| Stock line | `available = max(0, qty - held)`. Phase 4 has no holds yet, so `held = 0` behind one function `heldByListing(db, storeId)` that phase 5 fills. Lines: "3 left", "Last one", "On hold. Back in about 12 min if not sold.", "Sold out". Sold out sorts last. | Phase 5 drops in without touching the page. |
| Hidden / inactive | `active = false` listings never appear publicly. Sold-out (qty 0) shows desaturated with no price. | Matches dashboard semantics. |
| Rows | Render all (existing `MAX_ROWS` 1000 cap), tiles get `content-visibility: auto; contain-intrinsic-size`. | 500 tiles is ~35 KB gzipped HTML; no pagination code. |
| Images | `next/image`, `sizes="(min-width:1024px) 180px, 45vw"`, `quality={70}`, first 4 tiles `priority` (one row on desktop, two on mobile), rest lazy. `images.minimumCacheTTL = 2592000` (30 days) in `next.config.ts`. Only `safeImageUrl` hosts. Missing art: paper placeholder with set number in Big Shoulders. | Our own optimiser is the "proxy and cache" PRICING-API asks for; no hotlinking of full-size art. |
| Chart | Server-rendered inline SVG (`price-chart.tsx`, about 80 lines): market polyline in seal grey, dashed orange "This table" line, 3 y ticks, start/mid/end x dates, `<title>` per point for hover. 30 / 90 toggle is `?range=90`. Text summary "Up 8% in 30 days" plus a visually hidden table of points. Fewer than 3 points: "Not enough price history yet." | No chart library, no JS. A drag tooltip is skipped; add when buyers ask. |
| History backfill | Sync job (not the request path): for catalog items with fewer than 3 `price_point` rows, one `getHistory(ref, 90)` call (counts against `SYNC_MAX_CALLS`), upsert points. TCGdex returns `[]`, fine. | We only start collecting at first add; without it every chart is empty for days. |
| Table number | New `store.table_label` (1 to 8 chars, `^[A-Za-z0-9-]+$`), set in settings and on the sign page. Shown as the orange table block in the store header and on the sign. | Show floor wayfinding; SCREENS references "Table B14". |
| QR | `uqr` (unjs, zero deps, TS, MIT) `renderSVG(url, { ecc: 'M', border: 4 })`, server only. | Smallest maintained encoder; runs on the server so client bundle is untouched. |
| QR target | `${BETTER_AUTH_URL origin}/<slug>?src=sign`. NFC tag URL shown on the sign page: `...?src=nfc`. | Printed signs are permanent, so the source tag is baked in now even though nothing reads it yet. |
| Sign copy | Store name, "Scan to see prices and stock", QR 80 mm (A5) / 110 mm (A4), typed URL, facts row "Market-checked prices", "Updated daily", "Pay at the table", table block "Table B14" if set, "Or tap your phone here" + contactless icon only when `nfc_enabled`, "Powered by shoptcg.app". | UI-SPEC orchestrator review notes. |
| Print | `/dashboard/sign?size=a5|a4`. `@page { size: A5 portrait; margin: 0 }` or A4; `@media print` hides dashboard chrome. White paper, galaxy ink, orange band prints mid grey. | SCREENS section 11. |

## Schema changes

Migration `0008_store_page.sql` (via `pnpm db:generate`):
- `store.table_label text null`, check `store_table_label_format`: `table_label ~ '^[A-Za-z0-9-]{1,8}$'`.
- Index `listing_store_public_idx on listing (store_id) where active` (public reads filter on it).
No other tables. `price_point` PK `(catalog_item_id, date, source)` already serves history reads.

## Server code

- `src/lib/storefront.ts` (new, pure + DB):
  - `getPublicStore(db, slug)` -> `{ id, slug, name, logoUrl, isOpen, tableLabel, secondCurrency, fxRate, nfcEnabled, priceRulePct, rounding }` or null.
  - `listPublicStock(db, store, filter)` reuses `listStock` with `active` only, adds multi-language, `sort` (`price-desc` default, `price-asc`, `name`, `new`), computes `price`, `alt` (second currency), `underPct`, `available`, `holdEndsAt` (null until phase 5). Sold out last.
  - `heldByListing(db, storeId)` returns an empty Map in phase 4.
  - `pricesUpdatedOn(db, storeId)` -> latest `price_point.date` for the store.
  - `getPublicItem(db, storeId, listingId)` (uuid validated; must belong to store and be active) -> row or null.
  - `priceHistory(catalogItemId, days, utcDate)` with `'use cache'` + `cacheLife('hours')`.
- `src/lib/fx.ts`: `altPrice(usd, rate)` and `formatAlt(code, n)` with `Intl.NumberFormat(..., { currency: code, maximumFractionDigits: 0 })` (approx is whole units). Vitest.
- `src/lib/under-market.ts`: `underPct(price, market)` -> integer or null. Vitest edge cases (exact 5 %, market null, price above market).
- `src/lib/qr.ts`: `qrSvg(url)` wrapping `uqr`.
- Settings: add `tableLabel` to `settingsSchema` (trim, empty -> null, regex above). Settings action calls nothing new (page is uncached).
- Search param parsing in `src/app/[slug]/params.ts` with zod: unknown values dropped silently, `q` trimmed to 60 chars.

Auth: public pages read only `active` listings of the slug's store; no ids from other stores resolve (store id is in every where clause). No new public JSON endpoint (PPT "competing API" rule): data only leaves as rendered HTML.

## UI screens and states

All in Show floor primitives: hall background, paper tiles for the list bar, `stamp` badge (2 degrees off true, orange outline), tape-hatch "On hold" overlay, hang-tag price on detail, table-number block, notched `btn-ticket` with stub for the primary action. Big Shoulders for name, prices, table number; Schibsted for body. Square corners.

1. `/[slug]` store page: header (logo or monogram, name, table block, "Open" / "Closed" text + dot, "214 items. Prices updated Nov 9."), closed banner "Browsing only. [Name] isn't taking requests right now." (add buttons and list bar not rendered), sticky controls (search, type chips, language chips), count + sort, grid (2 cols mobile, 3 to 4 tablet, auto-fill 180 px desktop, max 1200 px), footer "Prices are this seller's asking prices. Market prices from public sales data, updated daily." + Terms link. Bottom padding equals list bar height.
2. States: loading = 6 skeleton tiles in the Suspense fallback; no results "No matches for "zard"." + [Clear filters]; empty store "This store hasn't added stock yet. Ask at the table."; `not-found.tsx` "We can't find that store. Check the link on the table sign." (404); error boundary `error.tsx` generic copy + [Try again].
3. `/[slug]/item/[id]`: back link "Back to store", art (slab 3:5, sealed 1:1, card 63:88), name, meta, grade badge, hang-tag price + approx + "Market $48.10" + stamp, stock line, chart with 30/90 segment links, caption "Market price, daily. Source: public sales data.", sticky [Add to list] ticket button (hidden when closed: "Browsing only."; on hold: "On hold for another buyer. Check back in about 12 min."). 404 for unknown or hidden listing.
4. List island (phase 4 scope): add toggles item into `localStorage["list:<slug>"]` (24 h TTL), button flips to check + qty, list bar on paper "2 items, $86.00" + [Review list] (links to `/[slug]/list`, built in phase 5; phase 4 renders the bar only). Holo shimmer: not on the public page in v1 (motion budget); static art.
5. `/dashboard/sign`: preview on screen at true size, controls (A5 / A4 segment links, table number input saved to `store.table_label`, NFC toggle reads `nfc_enabled`, shown as a link to settings), [Print] ticket button (`window.print()` in a 5-line client component), NFC instructions "Write this link to an NTAG215 tag: shoptcg.app/slug?src=nfc".

No toasts on public pages. Sign page uses existing toast #5 (Settings saved) when the table number is saved.

## Security notes

- No PII on this phase. No rate limit on reads (server rendered, cheap); revisit if logs show scraping.
- Slug regex check before any DB call (exists). Listing id must be a uuid before querying (`z.uuid()`), else 404.
- `safeImageUrl` gates every `src`. `lang` attribute set from `listing.language` for JP/CN names.
- `noindex` is not needed: real 404s. Store pages are indexable; add `generateMetadata` title "[Store] - shoptcg".
- Sign page behind `requireStore()`.

## Performance budget

- LCP < 2.5 s on Moto G Power class, slow 4G (Lighthouse mobile). LCP element is the store name (text), so fonts use `display: swap` with Big Shoulders preloaded.
- Route JS for `/[slug]` <= 70 KB gzipped beyond the framework chunk (check `next build` route table). Zero `sileo`, `motion` in the route's client manifest (grep the built `.next/server/app/[slug]/page_client-reference-manifest.js`).
- HTML <= 60 KB gzipped at 500 items. TTFB server time < 200 ms at 500 items (log `performance.now()` around the query in dev).
- CLS < 0.05: skeleton tiles match tile dimensions; price width reserved with tabular numerals.

## Tasks (in order, each with its check)

1. Add `table_label` + partial index, generate `0008`. Check: `pnpm db:migrate` on PGlite, `pnpm typecheck`.
2. `fx.ts`, `under-market.ts` + Vitest. Check: `pnpm test src/lib/fx.test.ts src/lib/under-market.test.ts`.
3. `storefront.ts` queries + `listings`-style Vitest on PGlite (filters, sold-out last, hidden excluded, other store's listing id returns null). Check: `pnpm test src/lib/storefront.test.ts`.
4. Real 404: restructure `src/app/[slug]/page.tsx` (lookup before Suspense, `instant = false`), add `not-found.tsx`. Check: e2e `request.get('/no-such-store')` status 404; `/ab` (bad slug) 404.
5. Store header + closed banner + grid + tiles (server components) reusing the Show floor primitives already in the branch (`src/components/stamp.tsx`, `tape-hatch.tsx`, `table-number.tsx`, `hang-tag.tsx`, `ticket.tsx`, `ticket-button.tsx`, `src/styles/showfloor.css`). Confirm each is a server component or move its client part out; do not re-create them. Check: `pnpm dev`, screenshot at 390 / 768 / 1280.
6. Filters and sort via search params. Check: e2e chips change result count; URL shareable.
7. List island (add, list bar, localStorage). Check: e2e add two items, reload, bar shows "2 items".
8. Item detail + `price-chart.tsx` + `priceHistory`. Vitest for the chart scale function (`scale(points, w, h)` min/max, flat line, single point). Check: `pnpm test`, item page renders with seeded 30 points.
9. History backfill in `syncPrices` (items with < 3 points). Check: `pnpm test src/lib/sync-prices.test.ts` with fake provider asserting one history call per thin item and none for items with 3+.
10. `next.config.ts` `images.minimumCacheTTL`; `sizes` + priority. Check: Lighthouse mobile run on the seeded store, LCP < 2.5 s.
11. `qr.ts` + Vitest that decodes the generated matrix with `jsqr` (devDependency) back to the exact URL. Check: `pnpm test src/lib/qr.test.ts`.
12. `/dashboard/sign` + table label setting + print CSS. Check: Playwright `page.pdf({ format: 'A5' })` produces 1 page; e2e NFC line hidden when `nfc_enabled` false, shown when true.
13. Bundle check script `scripts/check-public-bundle.sh` (grep client manifest for sileo/motion). Check: script exits 0 after `pnpm build`.

## Playwright e2e (`e2e/store-page.spec.ts`)

- Unknown slug returns 404 status and the not-found copy.
- Vendor seeds 3 listings (raw EN, graded, JP), opens public page in a fresh context (no cookies): sees prices, "approx." line after setting AUD 1.52, stamp on a listing priced 10 % under, filters Graded and JP narrow the count, search by number finds one.
- Closed store: no add buttons, banner visible; opening the store shows them.
- Sold out (qty 0) shows "Sold out" without price, sorted last; hidden listing absent and its detail URL is 404.
- Item detail shows chart summary or "Not enough price history yet."
- Sign page: QR `<svg>` present, URL text equals `/<slug>`, NFC line toggles with the setting, A5 PDF is one page.
- Run at 390, 768, 1280 widths (project matrix) and save shots to `.planning/phases/04-store-page/shots/`.

## Definition of done

- All tasks' checks pass; `pnpm lint && pnpm typecheck && pnpm test && pnpm e2e` green in CI.
- Unknown slug is a real 404 (status, not just copy). Soft-404 ponytail comment removed.
- Lighthouse mobile LCP < 2.5 s on a 500-item seeded store; no sileo or motion in the public route bundle.
- A printed A5 sign scans on an iPhone and an Android phone from 1 m (owner spot check, noted in the PR).
- Shots at three widths reviewed against v3-showfloor.
