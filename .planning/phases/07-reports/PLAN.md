# Phase 7: Reports + customers

Branch `phase-7-reports`. Builds on phase 6 (`sale`, `sale_line`, `customer`, unsubscribe). Autonomous run: every decision below is final unless a check fails.

## Goal

After a show the vendor picks a date range and gets revenue, sales count, items sold, average sale, discounts, a payment method split that matches the cash box, best sellers and the sales list, with a CSV export that is safe to open in Excel. The vendor sees their customers and exports only opted-in buyers for promos, each with a working unsubscribe link. Promos are export only in v1 (PROJECT default).

## User stories

1. Vendor: "Today" shows my show so far; "This weekend" covers Saturday + Sunday; custom picks any range.
2. Vendor: Cash total is first and bold so I can count my cash box against it.
3. Vendor: I export the report as CSV and open it in Excel or Sheets without formula surprises.
4. Vendor: I see all buyers I sold to, and export only those who opted in, with an unsubscribe link per row for my mail tool.
5. Buyer: once I unsubscribe I never appear in a promo export again.

## Decisions (default and why)

| Topic | Decision | Why |
| --- | --- | --- |
| Timezone | Built in phase 6: the dashboard layout sets the `tz` cookie (`time-zone-cookie.tsx`), `sellerTimeZone()` reads it through `safeTimeZone` (UTC fallback), and each sale stores its `time_zone`. Reuse them. Range boundaries computed in SQL: `created_at >= (from::date)::timestamp at time zone $tz` and `< (to::date + 1)::timestamp at time zone $tz`. | "Today" must mean the vendor's day; no settings field to forget. |
| Range input | Search params `?from=YYYY-MM-DD&to=YYYY-MM-DD`; preset links Today, This weekend (most recent Sat-Sun, or the current one), Custom = two native `<input type="date">` in a GET form. Max span 366 days. Default Today. | Zero JS, shareable, native picker. |
| Aggregation | SQL over `sale`/`sale_line` in the range, excluding nothing (test requests never create sales). Revenue = sum(total); Sales = count; Items = sum(qty); Average = revenue / sales; Discounts = sum(discount). Payment split: count + total per method in fixed order Cash, Card, Transfer, Other (zero rows shown). Best sellers: top 10 grouped by `(catalog_item_id, name, grade_label)` or by name for custom items, by revenue (line qty x unit_price, pro-rata discount not applied, labelled "before discounts"). | Simple, explainable numbers; matches the cash count since totals are post-discount. |
| Sales list | Server-rendered table, each row a native `<details>` that expands line items. Watermelon Transaction List skipped. | Accessible, zero JS; Transaction List needs 37 colour swaps and has no reduced-motion handling. |
| CSV export | Route `GET /dashboard/reports/export?from&to` (route handler, vendor session) returning one row per sale line: `date, time, receipt_no, buyer_first_name, item, set, number, grade, language, qty, unit_price, sale_discount, sale_total, payment_method`. Filename `shoptcg-<slug>-<from>[_<to>].csv`. UTF-8 BOM, CRLF, RFC 4180 quoting. | One flat file pivots easily; per-line lets the vendor see what sold. |
| CSV injection | `csvCell(v)` in `src/lib/csv.ts`: if a string starts with `=`, `+`, `-`, `@`, tab or CR, prefix `'`; then quote if it contains `"`, `,`, CR or LF (double quotes inside). Numbers are written by our own formatter (never prefixed, they are not user strings). Applied to every cell in both exports. | OWASP CSV injection guidance; buyer names and custom item names are attacker controlled. |
| Customers | `/dashboard/customers` (under More): name, email, purchases, last purchase, Promo status ("Subscribed since Nov 9" / "Unsubscribed Nov 12" / "Receipts only"). Filter chips All / Subscribed. Search by name or email. | Vendor sees who bought; status makes consent visible. |
| Promo export | `GET /dashboard/customers/export` only rows with `promo_opt_in = true`: `name, email, subscribed_at, unsubscribe_url`. Filename `shoptcg-<slug>-promo-list-<date>.csv`. Copy above the button: "Only buyers who ticked the box. Include the unsubscribe link in every email you send." | Export only in v1; vendor's mail tool must carry our link so opt-outs land here. |
| Unsubscribe handling | Already built in phase 6; this phase adds the status column and makes sure exports read `promo_opt_in` at export time. No manual re-subscribe button for vendors. | Vendors must not re-add someone who opted out. |
| Delete customer | [Remove customer] on the row (inline confirm) deletes the `customer` row (erasure request). Sales keep their snapshot name/email (receipts are financial records). | GDPR-style erasure without breaking immutable receipts. |
| Toasts | #22 "Exported / shoptcg-...csv, 31 rows" and #23 promo list exported: CSV links are plain downloads, so the toast fires from a tiny client wrapper that `fetch`es the CSV, makes a Blob URL, triggers download, and reads the row count from an `X-Row-Count` header. Errors -> #26 with [Try again]. | State map needs the count; the export also works as a plain link for no-JS. |
| Run Widget | Skipped (adds `@number-flow/react`). Summary is a definition list per SCREENS. | No hero metrics; no new dep. |

## Schema changes (migration `0011_reports.sql`)

- Index `sale_store_created_idx (store_id, created_at)` exists from phase 6; add `sale_store_method_idx (store_id, payment_method, created_at)` only if EXPLAIN on a 5,000-sale seed shows a seq scan (expect not; skip by default).
- `customer_store_optin_idx (store_id) where promo_opt_in`.
- No new tables. If no index is needed, this phase has no migration beyond the partial index.

## Server code and routes

- `src/lib/reports.ts`: `parseRange(params, tz, now)` (pure, Vitest: defaults, weekend logic on a Sunday and a Wednesday, from > to swapped, span cap), `salesReport(db, storeId, range)` -> `{summary, byMethod, bestSellers, sales}`, `reportCsvRows(...)`.
- `src/lib/customers.ts`: `listCustomers(db, storeId, filter)`, `promoRows(db, storeId)`, `removeCustomer(db, storeId, id)`.
- `src/lib/csv.ts`: add `csvCell`, `toCsv(rows)`.
- `src/lib/tz.ts`: `validTz(v)`.
- Routes: `src/app/dashboard/reports/page.tsx`, `src/app/dashboard/reports/export/route.ts`, `src/app/dashboard/customers/page.tsx`, `src/app/dashboard/customers/export/route.ts`; `removeCustomer` server action.
- Auth: every query takes `store.id` from `requireStore()` (route handlers use the same session helper; 401 JSON-free plain response if missing). Range and filters validated by zod; invalid -> defaults.
- Responses: `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="..."`, `Cache-Control: no-store`, `X-Row-Count`.

## UI screens and states

1. `/dashboard/reports` (Sales tab gets a "Report" link; More lists Customers): range presets as paper tab stubs, custom date form; summary `<dl>` with Big Shoulders values (Revenue, Sales, Items sold, Average sale, Discounts given); payment table with Cash first and bold plus "Count your cash box against the Cash total."; best sellers (thumb, name, qty, revenue, caption "before discounts"); sales list with expandable rows linking to receipts; [Export CSV] secondary ticket button. Desktop: summary and payment side by side.
   States: empty "No sales in this range." + "Sales you confirm at the table show up here."; loading skeleton rows in Suspense; error boundary "Couldn't build the report. [Try again]".
2. `/dashboard/customers`: chips, search, rows, status text, [Export promo list] (disabled with "No one has opted in yet." when zero), remove inline confirm. Empty: "No customers yet. Buyers appear here after their first confirmed sale."
3. Show floor: report reads like a show-end tally sheet on paper (perforated top edge, table number block with the store's table label), no charts.

## Security notes

- IDOR: store id from session only; no store id in params.
- CSV injection safe as above, tested with `=HYPERLINK(...)`, `+1`, `-2`, `@SUM`, leading tab.
- PII: promo export restricted to opted-in rows at query time; report CSV uses buyer first name only (no email). Customer page shows email (needed for the vendor's own records).
- Exports rate limited to 30 per hour per vendor (in-memory counter is enough on one instance; `ponytail:` note to move to DB if scaled out).
- No caching of export responses (`no-store`).

## Performance budget

- Report page server time < 300 ms for 5,000 sales in range (seeded Vitest benchmark on CI Postgres, logged not asserted).
- Export of 20,000 lines < 2 s, streamed as one string (fine at that size).
- No client JS on the report page beyond the export toast wrapper (< 5 KB).

## Tasks (in order, each with its check)

1. `csvCell` / `toCsv` + Vitest (injection prefixes, quoting, CRLF, BOM). Check: `pnpm test src/lib/csv.test.ts`.
2. `tz.ts` + `tz` cookie effect in dashboard layout. Check: Vitest `validTz('Australia/Sydney')` true, `'Mars/Base'` false.
3. `parseRange` Vitest. Check: `pnpm test src/lib/reports.test.ts`.
4. `salesReport` Vitest on PGlite: seed sales across midnight in `Australia/Sydney` vs UTC and assert they land on the right day; payment split sums to revenue; best sellers order.
5. Reports page UI + states. Check: dev screenshot at 390 / 1280.
6. Report CSV route. Check: e2e download, parse with `parseCsv`, row count equals `X-Row-Count`.
7. Customers lib + page + remove action. Vitest: other store's customer id not removable.
8. Promo export route. Vitest: unsubscribed customer absent; e2e download contains unsubscribe URL that works.
9. Export toast wrapper (#22, #23, #26). Check: e2e sees "Exported".
10. Partial index migration. Check: `pnpm db:migrate`; EXPLAIN on seed uses index scans (noted in PR).

## Playwright e2e (`e2e/reports.spec.ts`)

- Seed via the real flow (helper from phase 6): 3 sales today (Cash, Card, Cash with discount) and 1 sale backdated by a test-only SQL seed helper (`e2e/db.ts` using `DATABASE_URL`) to last week.
- Today report: Sales 3, Cash row total equals the two cash sales, Discounts equals the discount, last week's sale absent; Custom range including last week shows 4.
- CSV: download, first data cell of a buyer named `=cmd|' /C calc'!A0` is prefixed with `'`.
- Customers: opted-in buyer shows "Subscribed since"; unsubscribe via outbox link -> status "Unsubscribed", promo export excludes them.
- Empty range shows "No sales in this range."
- IDOR: vendor 2's export contains none of vendor 1's sales.

## Definition of done

- All checks pass; CI green.
- Report totals match a hand-counted seeded show (Vitest fixture with known sums).
- CSV opens in Excel and Google Sheets with no formula execution (owner spot check, noted in PR).
- Unsubscribed buyers never appear in a promo export (test).
- Shots of report and customers at 390 / 768 / 1280 in `phases/07-reports/shots/`.
