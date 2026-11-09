# Show floor: critique of the real app

Branch `show-floor`, run on `next dev -p 3210` with the e2e outbox sign-in, driven by Playwright at 390x844, 768x1024 and 1280x800 (touch on for 390/768). 105 screenshots in `critique/` (`<screen>-<state>-<width>`; toasts captured at t120-t550 ms and settled). Reference: `design/variations/v3-showfloor/index.html` + `NOTES.md`, UI-SPEC "Visual direction decision (2026-11-09)".

Method note: impeccable `critique` ran without PRODUCT.md/DESIGN.md (neither exists; `.planning` docs used as context, same as the mockup). The deterministic detector (`npx impeccable --json src/app src/components`) returned **0 findings**: no gradient text, glass, side-stripes, hero-metric or icon-card grids. Every issue below comes from looking at the running app.

## Verdict

The landing at 1280 and 390 is close to the mockup and does not read as AI-made: documentary hall photo, poster headline bleeding off the bottom, request ticket dropped on the photo, paper section with numbered steps. Login, create store, empty states and the ticket buttons hold the language too.

Where it falls apart is **every toast**. Sileo's pill-plus-body shape with `roundness: 0` breaks into two detached rectangles: a narrow tab (icon + 2-word title) and a wide paper slab, flipped upside down on phones (body above, title below). That is the "tiny Sold out floating mid-list" bug. On phones it covers the row the vendor just touched. At 768/1280 it sits over the Add button and the first price tag. It drifts from the mockup's toast: one full-width slab with icon, bold title and sentence on a single row, errors on **night** with a red ring, not on paper. Beyond the bug, the toasts also repeat what the page already shows (login, store created, first card, settings saved), so each moment gets announced twice.

Second biggest problem: **"You're open" next to "Closed"**. New stores default to `is_open=false`, so the celebration ticket contradicts the status line right below it.

## Design health score (Nielsen, 0-4)

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 2 | Toasts detached/upside-down; "Not saved." inline text lingers after reconnect; "You're open" vs "Closed" |
| 2 | Match system / real world | 4 | Table numbers, hang tags, tickets, vendor voice; the hall metaphor holds |
| 3 | User control and freedom | 3 | Hide/Try again exist on page and in toast; Escape dismiss; no undo on step-to-zero |
| 4 | Consistency and standards | 2 | Error toast on paper (mockup: night); "No price" styled as a price tag; Add ticket stub is "+" where every other ticket uses an arrow |
| 5 | Error prevention | 3 | Native browser tooltip for required fields ("Please fill out this field") breaks the look; CSV preview before saving is good |
| 6 | Recognition over recall | 3 | Phone inventory header has an unlabeled icon button (CSV import) |
| 7 | Flexibility and efficiency | 2 | Add stock puts three rows of toggles before the search box; custom item defaults to Chinese |
| 8 | Aesthetic and minimalist | 3 | Landing excellent; import page wall of fine print; duplicate page + toast messages |
| 9 | Error recovery | 3 | Copy is good ("The count didn't reach the server, so it's back at 1"); placement is the problem |
| 10 | Help and documentation | 3 | CSV template + column help present; import fine print too dense |
| **Total** | | **28/40** | **Good, held back by toasts and state contradictions** |

Overall design score: **7/10** (landing 9, auth/onboarding 7, inventory/add/import 6, toasts 3).

## AI-made / drift check

- **Toasts (all screens): drift, and they look like a component library fighting the brand.** Mockup `.toast` = one 470px (100% on phone) grid row: `ic | text | button`, receipt-bite top edge via `::before`, tear-in with `clip-path`. Implementation = Sileo morphing pill. Fix list P0-1.
- **Grey placeholder thumbnails** (sealed box / slab / card outline icons in 44x60 grey boxes) on inventory and the CSV preview are the one generic, template-looking element left. The mockup only ever shows photographed card art.
- **Skeleton loading** on inventory (five flat grey rectangles, `import-toast-t200-390.png`) is generic shadcn. The hall has no grey.
- **Login 1280 photo**: the cards on the table are recognisably generated (mushy art, repeated layout). Fine at a glance, but it's the image an owner who hates AI work will notice first. NOTES.md crops logos but not this.
- Landing, login, create store, ticket buttons, hang tags, numbered section marks: on-reference, no AI tells.

## Mobile ergonomics at a card show (390)

- Tap targets: steppers, ticket buttons, inputs, segmented toggles all >= 44px tall. Filter tabs (`All` 20px, `EN` 20px, `JP` 18px wide) and the footer `Terms` (39px) are narrow; the hit area needs padding (P1-9).
- One-handed: primary actions sit in the top third (Add, search, Save settings mid-page). Toasts land in the bottom thumb zone and cover the row being stepped. Bottom nav is good.
- Glare: paper tickets and hang tags read well in bright light. Weak spots are the `muted` grey metadata on black (`151. Sealed. EN`, `Fixed price`, ~13px) and the bright-red "Not saved." text on black. Raise metadata to `--seal`-light and 14px.
- Store open is a 24px checkbox buried in section 03 of settings. Vendors will flip it at the table every show (P0-2).

## Fix list

### P0: must fix

1. **Toasts: replace the pill+body with the mockup's single slab** (all screens, worst at 390 inventory). Today the narrow title tab and the wide body separate; on phones the body sits *above* the title, covering the row just changed (`soldout-toast-t380-390.png`, toast box y 592-756 over the Pikachu stepper). Fix: render the mockup's `.toast` (grid `auto 1fr auto`, gap 12px, padding 14px 16px 14px 14px, 15px/1.4, title in `<b>` inline with the sentence, button in the 3rd column), full width minus 16px gutters on phone. If Sileo stays, override it to a single flat block: `[data-sileo-pill]{display:none}` with the header moved into the body, or use Sileo's custom render. Don't keep tuning the morph.
2. **Store-created says "You're open"; status says "Closed"** (dashboard, all widths). `stores.is_open` defaults false. Fix: either default new stores to open, or change the moment to "Your page is live" with the stamp reading `Live`, and add a big Open/Closed switch at the top of the dashboard under the store name (44px, paper when open, line when closed). Remove "Store open" from settings section 03 or mirror it.
3. **Phone toast position: top, under the header, not over the thumb zone** (390). Bottom-center at offset 76 lands on the list row the thumb just used. Fix: `position="top-center"`, `offset={{ top: 64 }}` on phones; it tears down like a ticket printing, matching the mockup's `tear` keyframe (`translateY(-22px)` + `clip-path` from the top).
4. **Desktop/tablet toasts cover the primary action** (768/1280 inventory, store-created, login). Top-right at `top:60` sits on the Add ticket button, the first price tag and the "You're open" ticket. Fix: bottom-right on >=768 (`offset {bottom:24,right:24}`). The bottom-right corner of a 1280 inventory list is empty.
5. **Error toast on paper with red title** (all widths). Mockup `.t-bad`: background `var(--night)`, text `--on-night`, `box-shadow: inset 0 0 0 1.5px var(--bad-night)`, ring icon. Paper is for things you hold. A failure should look like the hall. Also show the title on the same row as the sentence ("**Not saved.** The count didn't reach the server, so it's back at 1." + `Try again`).
6. **Duplicate announcements** (login sent, store created, first card, settings saved). The page already renders a paper ticket or inline "Saved." for each. Fix: drop the toast where the page itself changes (login sent, store created, first card on the add page, settings inline "Saved."). Keep toasts for things that happen off-screen or in a list (sold out, import result, errors, offline). That halves the toast count and every moment lands once.

### P1: should fix

7. **"No price" is drawn as a price** (inventory, all widths). A hang tag with "No price" in the poster face reads as a price at a glance. Fix: outline-only tag (`background:transparent; box-shadow: inset 0 0 0 1.5px var(--sun)`, text `--sun`, Schibsted 600 15px "Set a price") so it reads as a task, the way the mockup's stamps work.
8. **Add stock: search buried under three toggle rows** (390 `add-390.png`; search at y 480). At the table, vendors type first. Fix: search input directly under the title; Type and Language as a single compact row of chips under it (or collapse into a "Raw, English" summary button). Search catalog / Custom item becomes a text link under results ("Not in the catalog? Add a custom item").
9. **Narrow filter tabs** (inventory, all widths): `All` 20px, `EN`/`JP`/`CN` ~20px wide. Fix: `padding-inline: 12px; min-width: 44px` on each tab; keep the orange underline only on the active one.
10. **Unlabeled icon button on phone inventory header** (390): the CSV icon square is unclear next to "Add". Fix: `Import` text label (it fits: 390 - 32 gutter leaves room) or move import into the empty state and the Add sheet only.
11. **Add ticket stub shows "+"** (inventory header). Every other ticket button's stub is an arrow, and "+" duplicates "Add". Fix: arrow stub like the mockup's `.btn-ticket`, or no stub on this compact button.
12. **Native validation bubble** (`add-custom-errors-390.png`: grey Chrome tooltip "Please fill out this field"). Fix: `noValidate` on the form and render the existing field-error style (mockup component sheet: red line under input + "Enter a name" in 13px).
13. **Custom item defaults Language to Chinese** and lists it first (add custom). Fix: default English, order English, Japanese, Chinese.
14. **Skeleton = grey boxes** (inventory load, 390). Fix: render the list frame immediately and show the stale rows; or a single line of paper-ticket text "Counting stock..." in `--seal`. No grey rectangles.
15. **Inline "Not saved." persists after the toast says "Back online"** (390 `online-toast-390.png`). Fix: clear row errors on `online` and on next successful save; colour it `--bad-night` at 14px, not bright red.
16. **Public page link shows `http://localhost:3210/...`** on the dashboard while the ticket above says `shoptcg.app/...` (all widths, dev only but the format matters). Fix: display without protocol (`shoptcg.app/slug`) in the poster face as the mockup's sign does; add a Copy button (44px).
17. **CSV preview cramped at 390** (`import-preview-390.jpg`): item names wrap to four lines, the result badges float. Fix: on phone drop the "Row" column into the meta line ("Row 4"), give the item cell the width; badges under the meta line. Also "Qty 3. None" → "Qty 3. No price yet".
18. **Import page fine print** (390): a 9-line paragraph about catalog matching, a price provider and 30 searches an hour before the file button. Fix: one line ("We match each row to the catalog; anything we can't match comes in as a custom item you price."), quota detail only when it applies, in the result summary.
19. **Muted metadata contrast under glare** (inventory, settings help text): ~13px `muted-foreground` on galaxy black. Fix: 14px minimum and lift to `oklch(0.78 0.01 250)` (seal grey lightened) for metadata that the vendor reads (set, number, condition).

### P2: polish

20. **Toast tear-in timing**: at t120 the slab is a half-faded paper block with ghost text (`soldout-toast-t120-390.png`). Mockup: `tear .7s var(--expo)` with `clip-path: inset(0 0 100% 0)` → `inset(-10px 0 0 0)`, so the edge prints in and text never fades. Use that keyframe.
21. **Sold-out thumbnail overlay**: "Sold out" in white over a hatched thumb is tiny (11px) and duplicates the 0. Fix: the mockup's tape-hatch "On hold" treatment, applied to the whole row (`opacity .55` on art + a stamp "Sold out" two degrees off true on the price tag).
22. **Landing 768**: the hero paragraph sits on the brightest part of the photo (lamp + white table), so "with market" loses contrast. Fix: at 600-1000px move the copy block below the photo's lamp line or strengthen the left gradient scrim (`linear-gradient(90deg, oklch(0.12 0.015 285/.85) 0 45%, transparent 75%)`).
23. **Create store at 390 shows the full bottom nav** (Requests, Inventory, Sales, More) before a store exists; every tab leads back to this form. Fix: hide the nav until the store exists.
24. **Login 1280 photo**: replace or crop the generated card faces (left third). Use `table.jpg` cropped to slabs and boxes, or the hall photo. The owner rejected AI-looking work twice, and this is the screen they see most.
25. **Settings "Store settings" subtitle shows the full e2e email** and wraps; the long email also breaks mid-word in the login ticket (`crit-1280-1794...@exa / mple.test`). Fix: `overflow-wrap:anywhere` only on the email span with `word-break: keep-all` elsewhere, or break at `@` with `<wbr>`.

## What's working (keep)

- Landing 1280: headline cropped by the paper section, request ticket with table B14 and hold timer on the photo, caption "Saturday, 9:14 PM. Zone B". This matches the mockup almost one-to-one.
- Ticket buttons with perforated arrow stubs, hang-tag prices in Big Shoulders, numbered section marks (`01 Pricing`, `02 Second currency`): the physical metaphor carries through the product, not just the marketing page.
- Copy voice: "Your shelf is empty.", "The count didn't reach the server, so it's back at 1.", "Fixed prices you set on an item always win." Plain and vendor-first.

## Screens captured

`critique/`: landing-top/full, login, login-sent (t150/t400/settled), create-store, store-created (t120/t420/settled), dashboard-full, inventory-empty, add, add-search, add-custom, add-custom-errors, add-toast (t150/t550/settled), import, import-preview, import-toast (t200/settled), inventory, inventory-full, soldout-toast (t120/t380/settled), offline-toast, error-toast (t250/settled), online-toast, settings-full, settings-toast (t150/settled); each at 390, 768, 1280. Full-page captures show the fixed bottom nav mid-image (capture artifact, not a bug).
