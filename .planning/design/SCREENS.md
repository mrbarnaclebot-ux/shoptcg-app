# shoptcg.app screen specs

Mobile-first (390px reference). Tablet = 768px, desktop = 1280px. Tokens and components: `UI-SPEC.md`. Copy is final draft; brackets mark variables. No emoji anywhere; icons named are lucide.

Copy voice: a friendly vendor at the table. Short, plain, specific. Says what happened and what to do next. No exclamation marks except the confirmed-sale moment. Uses "list" (not "cart") in buyer copy because nothing is bought in-app; the request is "I'm interested", payment happens at the table.

Global states used below:

- Loading: skeletons shaped like the content (tiles, rows), never a centered spinner on a blank page.
- Offline (any screen): a slim `warning-bg` bar under the header: "No connection. Showing what was loaded at [time]." Actions that need the network disable with the reason inline.
- Generic error: "Something went wrong on our side. Try again." + [Try again]. Never show raw codes; log them.

---

## 1. Landing page (`/`, brand register)

Audience: vendors (buyers arrive by QR straight on a store, they never see this).

Mobile layout, top to bottom:
1. Wordmark `shoptcg.app` left, [Vendor sign in] ghost button right.
2. Hero: display type, two lines. "Your table, priced live." Sub: "List your Pokemon cards, slabs and sealed with market prices. Buyers scan your QR, pick what they want and ping you. You confirm at the table." Primary [Create your store] (48px, full width), secondary text link "See a demo store".
3. Product shot: a real-looking phone frame showing a store page with neutral placeholder art (rendered from the actual app later), tilted 0 degrees (no 3D tilt clichés).
4. Three steps as a numbered vertical list, not cards: "1 Add your stock. Search by name or number, or import a CSV." "2 Print your table sign. One QR, A5, any printer." "3 Sell at the table. Requests ping your phone; confirm and the receipt emails itself."
5. Proof strip for vendors: "Nightly price sync. Raw, graded and sealed. EN, JP and CN. Your own FX rate." as a single line of text separated by middots.
6. Footer: Terms, Contact, "Not affiliated with Nintendo, Creatures, GAME FREAK or The Pokemon Company."

Tablet/desktop: hero splits 6/6, phone shot on the right. Steps run horizontally as three columns of text (no boxes).

States: none beyond static. LCP target: hero text, so the phone image is lazy and below the fold on mobile.

## 2. Vendor login (`/login`)

Single column, max 400px, vertically centred on desktop, top-aligned on mobile.

- Title "Sign in". Sub "We'll email you a sign-in link. No password."
- Email input (label "Email", `type=email`, `autocomplete=email`, `inputmode=email`).
- [Email me a link] primary.
- Fine print: "New here? The same link creates your account."

States:
- Sending: button shows spinner, label "Sending link".
- Sent: replace form with "Check your email. We sent a link to [email]. It works for 10 minutes." + [Use a different email] ghost + "Didn't get it? Check spam, or [send again]" (send again disabled for 30s with a countdown "Send again in 0:24").
- Error invalid: "Enter an email like name@example.com."
- Error expired link (landing from email): "That link has expired. Enter your email and we'll send a fresh one."
- Rate limited: "Too many tries. Wait a minute, then try again."

## 3. Create store (`/onboarding`)

One screen, three fields, then done. Progress is not needed for three fields.

- Title "Name your store".
- Store name (required, 2 to 40 chars). Placeholder "Ridgeline Cards".
- Store link: prefix `shoptcg.app/` shown inline as non-editable text, slug input auto-filled from the name, editable. Live check: success "Available" (check icon) / danger "Taken. Try [ridgeline-cards-2]." / "Use lowercase letters, numbers and dashes."
- Logo (optional): 96px square drop zone, "Add logo" + "PNG or JPG, square works best". Without a logo, the store shows a monogram (initials on `surface-2`, sunrise-300 text).
- Base currency fixed USD (shown as text "Prices in USD. You can add a second currency later.").
- [Create store] primary, sticky bottom on mobile.
- Consent line under button: "By creating a store you agree to the [Terms]."

After create: go to dashboard with the inventory empty state (see 4).

Errors: slug taken on submit (race) keeps the form and focuses the slug with the message. Logo too large: "That image is over 2 MB. Try a smaller one."

## 4. Seller dashboard (`/dashboard`, installable PWA)

Mobile structure:
- Header (56px): store monogram + name; right side: live indicator and Open/Closed switch.
  - Live indicator: success dot + "Live" / warning "Reconnecting" / danger "Offline. Tap to retry". Text always present.
  - Switch label "Open" / "Closed". Turning closed asks inline (not a modal) "Close your store? Buyers can still browse but can't send requests." [Close store] [Cancel].
- Bottom tab bar (64px incl. safe area): Requests (count badge), Inventory, Sales, More. Icons + text labels.

### 4a. Requests tab (default)

- Install nudge (if not installed, dismissible, once per day): "Get request alerts when your phone is locked. Add shoptcg to your home screen." [Show me how]. On iOS it opens a 3-step inline guide (Share, Add to Home Screen, Open).
- Alerts row (first visit): "Sound on" toggle and "Test alert" link.
- Queue, newest first. Each pending request is a row block (surface, `radius-lg`):
  - Top line: buyer name (text-lg), "just now" / "4 min ago" (subtle).
  - Hold timer chip: "Hold 14:32" (`num`); under 3 min turns `warning` with clock icon: "Hold 2:41".
  - Lines: 40px thumb, name, condition/grade, qty x price (`num`, right).
  - Total line: "2 items" left, "$86.00" right (text-xl `num`).
  - Actions: [Decline] secondary, [Review sale] primary (opens 7).
- New request arrival: row enters at top (translate 12px + fade, 320ms), `accent-bg` wash and 2px `accent` ring that pulses twice, "New" badge. Sound (short two-tone chime) + `navigator.vibrate([80, 60, 80])`. Web Push when backgrounded: title "New request: [Maya R.]", body "2 items, $86.00. Hold ends in 15 min."
- Expired requests move to a collapsed "Expired today ([3])" group; copy "Hold ended. Items are back in stock."
- Today line at bottom: "Today: 6 sales, $412.50" (plain text, links to Sales).

Empty state: icon (inbox), "No requests yet." Sub: "When a buyer scans your table sign and sends a list, it lands here and your phone chimes." [Print table sign] secondary, [Send a test request] ghost (creates a fake request flagged TEST so the vendor can rehearse).

Loading: two skeleton request blocks.
Error: "Couldn't load requests. [Try again]". If SSE drops: header indicator switches to Reconnecting and a "Check for requests" button appears at the top of the queue (pull fallback from PROJECT.md risks).

### 4b. Inventory tab

- Search bar "Search your stock" + [Add] primary icon button (opens search-and-add, phase 3).
- Filter chips: All, Raw, Graded, Sealed, Hidden; sort menu (Recently added, Price high to low, Name).
- Rows (64px): thumb, name + set/number + condition, qty stepper on tap, price column: your price (`num` text-lg) over "Mkt $48.10" (subtle, `num`). Overridden prices show a small "Fixed" badge.
- Row swipe is not used (discoverability); tap opens an edit sheet: qty, condition, price override, hide.
- Stale price (sync older than 48h): warning badge "Price 3 days old".

Empty: "Your shelf is empty." Sub: "Add your first card by name or number, or import a CSV of your stock." [Add a card] primary, [Import CSV] secondary, "Download the CSV template" link.

Tablet/desktop: two-column layout. Left 400px: Requests queue (always visible, so a seller at a laptop never misses a ping). Right: Inventory as a real table (columns: item, lang, condition, qty, market, your price, status), condensed width 92 for density. Tab bar becomes a left rail.

## 5. Public store page (`shoptcg.app/[slug]`)

The money screen. Server-rendered, first 8 tile images eager, rest lazy.

Mobile layout:
1. Store header: monogram/logo 48px, store name (text-2xl, wdth 112), status line: "Open" (success dot + text) and "Table [B14]" if set; meta "[214] items. Prices updated [6:00 AM] today."
2. Closed state: `surface-2` banner directly under header: "Browsing only. [Ridgeline Cards] isn't taking requests right now." Add buttons and list bar are hidden; prices still show.
3. Sticky controls (stick under the top on scroll, solid `surface-2`):
   - Search "Search name or number" (search icon, clear button).
   - Row of chips, horizontally scrollable: type segment All / Raw / Graded / Sealed, then divider, then EN / JP / CN (multi-select).
   - Currency toggle at the right of the header: "USD | AUD" segment. Default USD. Choice remembered per device.
4. Result count: "48 items" + sort menu "Sort: Price high to low".
5. Grid: 2 columns, 12px gap. Tile (no card container):
   - Art (63:88, slabs 3:5, sealed 1:1 in a well). Overlay top-left: language tag "JP" when not EN.
   - Name (text-base 600, 2-line clamp; `lang` attr set).
   - Meta (text-sm muted): "[Set] [025/165]. [NM]" or for graded "[PSA 10]".
   - Price (text-xl `num`), second currency below "approx. A$64" (muted).
   - Stock line: "3 left" (muted) / "Last one" (text, weight 600) / "On hold" (hold) / "Sold out" (subtle).
   - Below-market badge (deal) above the name: "12% under market".
   - Add button: 44px square, `surface-2`, plus icon, `aria-label="Add [name] to your list"`. After add: becomes `accent` with check icon and the qty if >1.
   - On hold tile: art gets a 40% `hold-bg` overlay with a diagonal hatch and centred label "On hold"; add button disabled; stock line "On hold. Back in about [12] min if not sold."
   - Sold out: art desaturated (filter grayscale(0.8) opacity 0.6), price hidden, line "Sold out". Sold out items sort to the end and hide after the show day.
6. List bar (sticky bottom, appears after the first add): "[2] items, [$86.00]" left, [Review list] primary right.
7. Footer: "Prices are this seller's asking prices. Market prices from public sales data, updated nightly." Link "Terms".

Below-market rule: show the badge when vendor price is at least 5% under market. Copy "12% under market" (rounded down to whole percent). Never show "above market".

Second currency footnote (at the end of the grid, once): "AUD shown at the seller's rate: 1 USD = 1.52 AUD. You pay in whatever the seller accepts at the table."

States:
- Loading: header renders server-side; grid shows 6 skeleton tiles.
- No results: "No matches for "[zard]"." Sub: "Try the card number, or clear filters." [Clear filters].
- Empty store: "This store hasn't added stock yet. Ask at the table."
- Store not found: "We can't find that store. Check the link on the table sign."
- Price unavailable for an item (custom CN item): show the vendor price only, no market line, no badge.

Tablet: 3 to 4 columns. Desktop: max-width 1200px, auto-fill columns min 180px (6 across), controls become one row, list becomes a right-side panel (360px) instead of a bottom bar once an item is added.

## 6. Item detail (`/[slug]/item/[id]`)

Mobile: full page (deep-linkable), back arrow "Back to store".
1. Hero art, 80% width centred on `bg`, holo shimmer on touch/pointer move (UI-SPEC section 6). Slabs show the full slab.
2. Name (text-2xl), meta line: set, number, language, rarity. Condition or grade badge ("Near Mint", "PSA 10", "Sealed").
3. Price block: seller price text-3xl `num`, second currency below. Market line: "Market $48.10" with the below-market badge if it applies. "3 left" stock.
4. Price history chart: 30 / 90 day toggle (segment). Single line in seal-200 for market, horizontal dashed sunrise-400 line for this seller's price labelled "This table". Area under line `surface` tint. Axis: 3 y ticks `num` text-sm, x ticks start/mid/end dates. Tap/drag shows a tooltip with date + price. Caption under the chart: "Market price, daily. Source: public sales data." Text summary for screen readers and glance: "Up 8% in 30 days" / "Down 3% in 30 days" (`success`/`danger` text, arrow icon).
5. Sticky bottom [Add to list] primary (full width) with qty stepper when stock > 1.

States: chart loading skeleton (rect); fewer than 3 data points: "Not enough price history yet. We'll have more after a few nightly syncs."; on hold: button replaced by "On hold for another buyer. Check back in about [12] min."; closed store: no button, "Browsing only."

Desktop: two columns: art left (sticky), details + chart right.

## 7. List + request form (bottom sheet from list bar; `/[slug]/list` on desktop)

1. Title "Your list". Lines: thumb, name, condition, qty stepper (max = available), price (`num`), remove (icon button, `aria-label="Remove [name]"`).
2. Total: "Total at the table" `num` text-xl, plus second currency. Note: "The seller may adjust prices or add a discount when you meet."
3. Form:
   - Name (label "Your name", `autocomplete=name`), helper "So the seller knows who to look for."
   - Email (label "Email for your receipt", `autocomplete=email`).
   - Checkbox, unticked by default: "Email me when [Ridgeline Cards] has new stock or deals. Unsubscribe any time."
   - Consent text above button: "By sending, you share your name and email with [Ridgeline Cards] for this request and your receipt. See [Terms]."
4. [Send to seller] primary. Sub: "Items are held for you for 15 minutes."

Validation: on blur and on submit. "Enter your name." "Enter an email like name@example.com." Errors appear inline with an icon; focus moves to the first error.

Errors:
- An item went on hold or sold while listing: that line shows "Just taken by another buyer" (hold colour), qty set to 0, total updates, button label "Send without it".
- Store closed meanwhile: "[Ridgeline Cards] just closed. Your list is saved on this phone."
- Rate limited: "Too many requests from this phone. Wait a minute and try again."
- Network: "Couldn't send. Check your connection and try again." List is kept.

Empty list: "Your list is empty. Tap the plus on any card to add it."

## 8. Buyer waiting and confirmed (`/[slug]/request/[id]`)

Waiting:
- Large status: "Sent to [Ridgeline Cards]". Sub: "Head to the table and show this screen. Your items are held for you."
- Hold countdown: "Held for 14:32" (`num` text-3xl). Under 3 min: warning colour, "Hold ends soon. Find the seller at table [B14]."
- Request code: 4 characters in a `surface-2` box, text-3xl `num`, e.g. "K7Q2", labelled "Show the seller this code".
- The list (read-only) and total.
- [Cancel request] ghost at the bottom (confirm inline: "Cancel and release your items?" [Yes, cancel] [Keep]).
- Live updates via SSE; fallback poll every 10s.

Confirmed (seller confirmed sale):
- Success icon (check in success circle), "Sold. Enjoy your cards!" (the one exclamation mark in the product).
- Receipt summary (lines with final prices, discount, total, payment method), receipt number.
- The first purchased card's art gets a single holo sweep (reduced motion: static sheen).
- "Your receipt is on its way to [email]." [Back to store].

Declined: "The seller couldn't do this one." Sub: "Items are back in the store. You can talk to the seller at the table or send a new list." [Back to store].
Expired: "Your hold ended." Sub: "We released the items so other buyers can see them. If they're still there, you can send again." [Send again] (rebuilds the list from what's still available).

## 9. Seller confirm sale (`/dashboard/requests/[id]`)

Full screen on mobile (focused task), side panel on desktop.
- Header: "Sale for [Maya R.]", code chip "K7Q2" (matches buyer screen), hold timer.
- Lines: thumb, name, condition; qty stepper (can only go down); price input per line (`num`, prefilled with quoted price, `inputmode=decimal`). Changed price shows original struck in subtle: "was $48.00". Remove line (icon button).
- Discount: segment "None | $ | %" + amount input. Shows "Discount -$6.00".
- Payment method (required): segmented buttons, 48px: Cash, Card, PayPal, Other. Other reveals a short text input.
- Summary: Subtotal, Discount, Total (text-3xl `num`). Second currency approx. line if enabled.
- [Confirm sale, $80.00] primary (amount in the label to prevent mistakes). Disabled until a payment method is chosen; helper "Pick how they paid."
- [Decline request] destructive text button at the bottom, inline confirm.

After confirm: success toast "Sale saved. Receipt [R-0042] sent to [email]." Stock decrements; returns to queue.

Errors:
- Hold expired while editing: warning banner "The hold ended, but nothing has sold. You can still confirm if the items are here." Confirm still allowed if stock is available; otherwise lines show "No longer in stock".
- Confirm failed: "Sale not saved. Nothing was charged or changed. [Try again]." (stock untouched because the transaction failed).
- Email failed after save: "Sale saved. The receipt email didn't send. [Resend]" (sale is immutable; email is retryable).

## 10. Receipt (screen + email)

Screen (`/dashboard/sales/[id]`, and the buyer confirmed view):
- Store name + logo, "Receipt [R-0042]", date and time, "Paid by Cash".
- Lines table: item (name, set, condition), qty, price (`num`, right-aligned, no raised cents).
- Subtotal, discount, total (bold). Second currency approx line with the rate.
- Footer: "Sold by [Ridgeline Cards] at [Show name if set]. Questions? Reply to this email or find the seller."
- Seller-only actions: [Resend email], [Copy link]. Receipt cannot be edited (immutable); copy "Receipts can't be changed once saved."

Email (Resend, 600px table layout, light):
- Preheader: "Your receipt from [Ridgeline Cards], [$80.00]."
- Subject: "Your receipt from [Ridgeline Cards] ([R-0042])".
- Top: 4px sunrise-700 rule, store name in galaxy-950 Archivo/Arial fallback 22px bold.
- Body as screen receipt. Card thumbnails 48px (with alt text = card name) so it still reads with images off.
- Footer: "You got this because you bought from [Ridgeline Cards] on shoptcg.app." If opted in: "You're on [Ridgeline Cards]'s update list. [Unsubscribe]." Plain-text version included.

## 11. Printable QR table sign (`/dashboard/sign`, A5 portrait)

Screen shows a preview plus [Print] primary and options: size (A5 / A4), show table number (input), show NFC line (toggle).

Print layout (148 x 210 mm, 10mm safe margin, white background, works in pure black and white):
- Top band: 6mm sunrise-500 rule (prints as mid grey on mono printers, still fine).
- Store name: display type, galaxy-950, up to 2 lines, auto-shrinks to fit.
- Line: "Scan to see prices and stock".
- QR: 80mm square, galaxy-950 on white, quiet zone 4 modules, error correction M. Encodes `https://shoptcg.app/[slug]?src=sign`.
- Under QR: URL in text-xl `num`-style: "shoptcg.app/[slug]" so people without a scanner can type it.
- Three short facts in one row: "Live prices", "Pick and send", "Pay at the table".
- Optional: "Or tap your phone here" with a contactless icon at the bottom right where the NFC tag sits.
- Optional table number, top right: "Table B14".
- Footer micro line: "Powered by shoptcg.app".

`@page { size: A5; margin: 0 }`; hide all app chrome under `@media print`.

## 12. End-of-show report (`/dashboard/reports`)

- Date range picker: presets "Today", "This weekend", "Custom". Default Today.
- Summary as a definition list (not hero metric cards): Revenue, Sales, Items sold, Average sale, Discounts given. Each value `num` text-xl.
- By payment method: a small table (Cash, Card, PayPal, Other: count, total). This is what the vendor checks against the cash box, so Cash is first and bold. Copy above: "Count your cash box against the Cash total."
- Best sellers: top 10 by revenue (thumb, name, qty, revenue).
- Sales list: time, buyer first name, items, total, method, receipt number link.
- [Export CSV] secondary. Filename `shoptcg-[slug]-[YYYY-MM-DD].csv`.

Empty: "No sales in this range." Sub: "Sales you confirm at the table show up here." Loading: skeleton rows. Error: "Couldn't build the report. [Try again]."

Desktop: summary and payment table side by side, best sellers and sales list below.

---

## Interaction details shared by all screens

- Back navigation always works; the buyer's list persists in localStorage per store for 24h.
- All counts and prices update live without layout shift (reserve width with `num` and min-width).
- Focus order follows visual order; sheets trap focus and close on Escape and on swipe-down.
- Hit areas 44px minimum; spacing between adjacent targets 8px minimum.
- Text scales to 200% without horizontal scroll (grid falls back to 1 column at large text sizes).
