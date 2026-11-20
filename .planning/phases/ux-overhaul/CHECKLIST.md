# UX overhaul checklist (2026-11-19)

Every finding from the inventory review, the four area reviews and the research pass, mapped to a phase. Tick only when merged to `main`.

Decisions by the owner:
- Remove archives the item, with restore.
- A buyer holding a removed item sees "<item> was removed from the store", and it comes off their cart or request.
- A claim event blocks removal (default, not overridden).
- Adding a card the store already has tops up the existing row.
- Everything else follows the recommendations, and the Terms are updated.

## A. Inventory (PR #61, #63)
- [x] Remove = archive, Removed tab, Restore, Undo; ledger `removed`/`restored` moves
- [x] Buyers holding a removed item: taken off carts and requests, with an alert; an emptied request closes
- [x] Removal blocked during a claim event, with the reason given
- [x] Typed quantity; custom items can edit name, set and number
- [x] A duplicate add tops up the existing row (single add and CSV)
- [x] Word-by-word search across name, set and number (shared with the store page)
- [x] Sort; bulk hide/show/remove/restore; CSV export; paging past 1,000 with a real count
- [x] Phone filter-row fade; accurate limit message
- [x] Ledger stock valuation past 1,000 items → E
- [x] Buy picker past 1,000 items → C
- [x] Export/import round-trip keeps hidden items hidden (a `hidden` column) → E
- [x] Reason picker when lowering stock by hand (Correction, Count, Damaged, Lost) → E
- [x] Bulk "set fixed price / follow market" → E

## B. Bug sweep and Terms (PR #62)
- [x] New-request chime and toast on every dashboard page; Requests tab count
- [x] Queue first on the phone dashboard
- [x] Price rule as Under/Over market (iPhone had no minus key)
- [x] Store-aware 404s; `/dashboard/requests` redirect
- [x] Push opens the request; real hold length; a sale screen is never navigated away
- [x] Scroll padding for fixed bars (WCAG 2.4.11); viewport `viewportFit`/`themeColor`
- [x] Add-stock offline catch; sale-screen Decline failure; claim-event errors shown
- [x] Sign NFC link; nav active tabs; −$0.00; walk-up receipt toast; Sales header wrap; online empty queue; consent "and"; waiting-ticket name wrap
- [x] Getting started ticks (alerts; first buyer as the share/sign signal)
- [x] Help copy (store link changeable; step order); Terms updated, version 2026-11-19

## C. Selling loop (PR pending)
- [x] Back to the queue after confirm, with "View receipt" in the toast
- [x] Cash given and change
- [x] Confirm offline, sync on reconnect, never drop a sale
- [x] +15 min hold; "Ending" words on the hold warning; warning colour for Offline
- [x] Buy: catalog search, market price, offer % chips
- [x] Add panel: market → your price preview; remember last condition
- [x] CSV header aliases (TCGplayer, Collectr); `cost` in help and template
- [x] Sales: previous/next day
- [x] Add-stock search placeholder fits at 390
- [x] "Add item" on the sale screen
- [x] Buy picker past 1,000 items

## D. Store page (in progress)
- [ ] A way back to a sent request (stub on store and cart; Back to store)
- [ ] Item page: Add to cart above the fold on desktop; seller line; Set links to set search; condition explained
- [ ] Phone chip-row fade
- [ ] Graded tiles show set and number
- [ ] Slow-wifi feedback (`useLinkStatus`, item `loading.tsx`, `next/form` search); cart skeleton
- [ ] Copy buttons for bank details and order code
- [ ] Prefill buyer details (shared with the claim room)
- [ ] Market price source and date; one price format
- [ ] Table number on the waiting ticket from the start
- [ ] Feedback when a second tap removes from the cart
- [ ] Fieldset error wiring; heading levels; hide the stepper for last-one items
- [ ] Image `sizes`; store grid paging past 1,000; sold-out items last

## E. Settings and back office (PR #67)
- [x] More menu: settings vs work pages (Ledger, Report, Customers, Events, Sign, Preview); consistent layout and back links
- [x] Desktop More opens on Store profile; Account row on phones; Delete account at the bottom behind a disclosure; fix its export copy
- [x] One save pattern with an unsaved-changes bar; "Saved." clears on edit; warn on leave
- [x] Table number and NFC edited in one place (How you sell); read-only on Sign
- [x] Claim event form: errors per field with focus; no nested scroll; reason when Create is disabled; end time and time zone shown
- [x] Event status label in the house style; "Live" stamp
- [x] Claim events page width matches other pages; menu row for table stores
- [x] Pricing layout on desktop (played-card labels, rounding wrap)
- [x] Report: per-day rows; This month / Last month; wording matches the menu
- [x] Ledger: full CSV; item identity (set, number, condition) on stock moves; valuation past 1,000
- [x] Destructive actions consistent (Admin Dismiss confirm; event End/Block styling; store image remove undo)
- [x] Preview on phone opens the real page; "Open in new tab" on desktop
- [x] Customers empty state; placeholders say "e.g."; checkbox border contrast; "Chime for new lists" label
- [x] Remove customer button name (WCAG 2.5.3)
- [x] Admin: back link at the top; account search
- [x] Inventory leftovers from A: hidden column, stock-lowering reason, bulk fixed price

## F. Landing and foundations (not started)
- [ ] OG image, `metadataBase`, title template (drop hand-typed suffixes)
- [ ] Invite path: landing primary "Get an invite"; `/join` single ticket with Segmented
- [ ] Phone hero height so the main button is on the first screen; the product shown below 1280
- [ ] Hero headline wraps at text-only zoom (WCAG 1.4.4)
- [ ] Toast button focus ring contrast on paper (WCAG 1.4.11)
- [ ] Login: intro copy under the form; password show/hide; "Send again" / "Use a different email"
- [ ] Maskable app icon
- [ ] Shared public header and footer landmarks
- [ ] Help screenshots `alt=""` where the caption repeats it
- [ ] Delete unused `components/ui/button.tsx` and `card.tsx`
- [ ] Type scale: replace one-off sizes that equal tokens; add tokens for the common ones

## Considered, not planned (owner can pull in)
- Storefront bottom-sheet filters with "Show N results" and multi-select (Baymard); the chip rows stay for now.
- Offline lookup of stock and prices (C only queues confirms).
- Camera card scanning.
