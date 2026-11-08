# shoptcg.app personality pass

Status: proposal for owner review. Nothing here touches `src/`.
Trigger: owner feedback after trying the live app: "the site has to have some personality in it. it feels very flat and simple".
Inputs: `.planning/PROJECT.md`, `.planning/design/UI-SPEC.md`, `.planning/design/SCREENS.md`, Phase 1 landing shots (`phases/01-foundation/shots/polish/`).
Method: impeccable `bolder` + `delight` + `animate`. No PRODUCT.md exists; PROJECT.md stands in for it, as in UI-SPEC.

Fixed constraints for every direction:

- Galaxy black `#090911` base, seal grey structure, sunrise orange `#F77C10` for action only. Prices stay near-white, never orange.
- No emoji anywhere. Icons are inline SVG or text.
- No official Pokemon branding: no ball shapes, no red/white split circles, no yellow/blue wordmark, no card-back pattern, no official art. Mockups use invented card names ("Lunar Fox V-Star", "Twilight Drift 189/203") and abstract CSS art.
- Product register for the dashboard and store page (motion conveys state, 150 to 320 ms). Brand register only for the landing page and the QR sign.
- Toasts: Sileo (`sileo@0.1.6`, MIT, depends on `motion@^12.34`). Animated components: Watermelon UI (shadcn registry).

## Why it feels flat today

Read against the Phase 1 shots:

1. One voice everywhere. Headline, phone mock and button all carry the same weight and the same neutral tone. Nothing on the page sounds like a person who sells cards.
2. Nothing moves when something happens. Motion tokens exist in UI-SPEC section 5, but no feedback moment ships yet (no toasts, no add confirmation, no celebration).
3. The only motif is the holo sheen, and it is quiet by design. There is no second motif tied to the hobby (slab labels, pack crimp, price tags, table lights).
4. The copy is accurate but anonymous. "Create your store" could be any SaaS.

The fix is not "more effects". Pick one personality, give it a voice, one or two signature motifs, and a motion language, then spend it at the moments that matter: item added, request received, sale confirmed.

---

## Direction A: Card-shop night market

Warm, social, vendor-to-vendor. The convention hall after dark: string lights, a folding table, handwritten price tags, a regular saying "what've you got tonight?".

Mockup: `direction-a.html`. Shots: `shots/direction-a-390.png`, `shots/direction-a-1280.png`.

**Voice.** Second person, friendly, short, a little bit of table talk. It talks about "your table", not "your store". Never cute, never exclamation marks.

| Moment | Copy |
| --- | --- |
| Hero | "Your table's open. Prices are live." |
| Hero sub | "Lay out cards, slabs and sealed at tonight's market price. Buyers scan your sign, pick what they like and give you a nudge. You shake on it at the table." |
| Primary CTA | "Open your table" |
| Empty inventory | "Your table's bare." Sub: "Bring out the first card, or tip a whole CSV onto it." |
| Item added | "On the table". "Lunar Fox V-Star, NM. 3 copies at $1,240.00. Buyers can see it now." |
| Sale confirmed | "Sold to Maya". "Receipt R-0042 is on its way to her inbox." |
| Error | "That didn't save". "The hall WiFi blinked. Your change is still here." [Try again] |

**Motion language.** Soft settle. Springs slightly under-damped (stiffness 150 to 170, damping 20 to 22, about 2 to 3 percent overshoot), so things land like a card dropped onto felt. Toast pill enters, waits 220 ms, then the body unfolds. String lights breathe very slowly (5 s opacity cycle, off under reduced motion).
What moves: toasts, the new-request row (drifts in from 12 px), the price tag on the add button (swings 4 degrees once), the lights.
What never moves: prices, totals, timers, the hold countdown, table rows once placed.

**Motifs.**
- Texture: warm radial glow (sunrise at 10 to 25 percent alpha) pooling behind the hero, like a lamp over the table. Felt-dark table surface under fanned cards.
- Light: a string of lantern bulbs across the top of the landing page (SVG, 16 dots with orange drop-shadow glow).
- Shape: hang-tag price labels with a punched hole (cream paper `#F6E7D2`, dark text) for the one hero price.
- Toast: warm-tinted fill `#20160F`, badge carries a soft glow in its state colour.
- Type moment: the second line of the hero switches to a light sunrise tint (`#FFB070`) for "Prices are live." (solid colour, no gradient text).

**Risk.** It slides toward cozy and handmade, which reads cheaper than "premium collector vault". The warm glow muddies galaxy black and makes the sunrise accent lose its "tap this" meaning when it is also used as mood light. Under fluorescent show-hall lighting the glow vanishes and you are left with the copy. Hardest of the three to keep consistent in a dense seller table.

---

## Direction B: Grading lab

Precise, slab-like, technical. The feeling of a graded slab label: cert numbers, grade, a ruler on the edge, everything aligned to a grid. Confidence through exactness.

Mockup: `direction-b.html`. Shots: `shots/direction-b-390.png`, `shots/direction-b-1280.png`.

**Voice.** Declarative and numeric. Leads with the fact, then the number. Past tense for done things ("Logged", "Recorded"). No warmth words, but never cold to the point of rude: it always says what happened to the user's data.

| Moment | Copy |
| --- | --- |
| Hero | "Priced to the cent." (expanded) / "Raw, graded, sealed." (condensed, muted) |
| Hero sub | "Every item on your table carries a live market price and your rule on top. Buyers scan, pick and request. You confirm; the receipt files itself." |
| Primary CTA | "Create your store", with a tabular proof line beside it: "50 items in under 15 min" |
| Empty inventory | "0 items logged." Sub: "Search by name or number, or import a CSV." |
| Item added | "Logged #0187". Spec block: Condition NM, Qty 3, Your price $1,240.00, Vs market -4.8% |
| Sale confirmed | "Sale R-0042 recorded". "$1,240.00 cash. Stock 3 to 2. Receipt sent to maya@..." |
| Error | "Not saved ERR 504". "No response after 8 s. Your edit is held on this device." [Retry] |

**Motion language.** Critically damped, no overshoot (stiffness 380 to 420, damping about 2 x sqrt(k)). Things click into place like a slab into a case. Short: pill in under 200 ms, body at 140 ms delay. One signature: a row of ruler ticks under the toast spec block scales in from the left as the body opens (measurement being taken). Number changes use rolling digits (see `stepper` and `pagination` below).
What moves: toasts, ruler ticks, rolling digits in steppers and totals, the sync dot in the eyebrow (static under reduced motion).
What never moves: card art (except the existing holo on item detail), layout, the grid background.

**Motifs.**
- Texture: a 32 px hairline grid on the page background at 6 percent seal grey, like cutting-mat or graph paper.
- Shape: the slab. Hero visual is a slab with a white label strip (item name, set code, cert number, a large condensed grade numeral) and a ruler on its edge. Toasts use 7 px corners (squared, slab-like) instead of a full pill.
- Type: Archivo's width axis does the work. Expanded 125 for headlines and toast titles, condensed 72 for the secondary hero line and dense tables. Every number tabular. Toasts carry a stamp after a hairline divider: "#0187", "ERR 504", "R-0042".
- Eyebrow: a rule-bounded uppercase strip "Market sync 02:00 nightly" with a live dot.

**Risk.** Executed timidly it is exactly the "flat and simple" the owner complained about: grey, aligned, correct. Its personality lives in typography contrast and numbers, which only lands if the width-axis contrast is pushed hard and the stamps and ticks actually ship. Can feel cold to buyers who are browsing for fun.

---

## Direction C: Booster rip

Kinetic, celebratory, the 3 seconds of opening a pack. Foil, a crimped edge, cards rising out, a loud headline.

Mockup: `direction-c.html`. Shots: `shots/direction-c-390.png`, `shots/direction-c-1280.png`.

**Voice.** Short imperative verbs, hobby slang used sparingly ("pulled", "hit", "rip"). Uppercase toast titles. Celebrates wins, stays calm on errors.

| Moment | Copy |
| --- | --- |
| Hero | "Rip. List. Sell out." |
| Hero sub | "Your whole table, live-priced in minutes. Buyers scan, stack a list and ping you. You close it at the table." |
| Primary CTA | "Start your store" |
| Empty inventory | "Nothing pulled yet." Sub: "Add your first hit, or dump a whole CSV in." |
| Item added | "PULLED TO YOUR TABLE". "Lunar Fox V-Star x3, $1,240.00 each. Live for buyers now." |
| Sale confirmed | "SOLD. R-0042". "$1,240.00 in. Receipt flying to Maya." |
| Error | "SNAGGED". "That save didn't go through. Nothing's lost." [Retry] |

**Motion language.** Snappy with a little snap (stiffness 420 to 560, damping 30, about 4 percent overshoot, close to Sileo's own default curve). Headline words slam in once on load (staggered 80 ms, brand surface only). Cards rise out of the pack once. Success toasts get a single foil sweep across the pill (900 ms). Errors get a 3 px nudge, never a sweep.
What moves: toasts, the foil sweep (success only), the hero slam and card rise (landing only, once), the "sale confirmed" holo sweep on the buyer's card.
What never moves: anything on the seller dashboard beyond toasts and the new-request entrance; prices; the request queue order.

**Motifs.**
- Shape: the pack crimp. A zigzag edge (CSS conic mask) along the top of the landing page and on the pack top. Can also cap the sticky list bar on the store page.
- Foil: an animated holo wrapper on the hero pack (slow 6 s drift, off under reduced motion); a one-shot foil sweep on success toast pills. Foil stays on art and the success moment, never on chrome text.
- Type: Archivo 900 at width 125, uppercase, very large (up to 96 px). The middle word in sunrise orange as a solid colour.

**Risk.** Highest fatigue. A seller sees 50+ toasts during a show; sweeping foil and uppercase shouting every time becomes noise within an hour. Easiest to tip into "gaming / crypto drop" territory and the furthest from "premium vault". The kinetic hero costs LCP if the slam delays text paint (keep text visible at frame 0, animate transform only).

---

## Recommendation

**B as the chassis, C for three earned moments.** Name: "Lab and Rip".

- The seller dashboard, inventory and store page use Grading lab: critically damped motion, stamps, tabular spec blocks, width-axis contrast, ruler ticks. It matches what vendors need at a busy table (trust in numbers, nothing bouncing) and it keeps galaxy/seal/sunrise intact.
- Booster rip is reserved for three moments that are rare and actually worth celebrating: store created (first time), first item added (first time only), and sale confirmed (buyer screen gets the holo sweep; seller toast gets the foil sweep on the pill). The landing hero borrows C's scale (900 weight, width 125) and the crimp edge but not the slam animation.
- Night market contributes one thing: its warmth in error copy ("Your change is still here"). Errors should reassure about data first.

Why not A: it dilutes the accent colour and moves away from "premium". Why not pure B: it risks reproducing the flat feeling. Why not pure C: fatigue on the seller side.

Merged voice samples (B base, C moments):

| Moment | Copy |
| --- | --- |
| Hero | "Priced to the cent." Sub-line condensed: "Raw, graded, sealed." |
| Empty inventory | "0 items logged." "Search by name or number, or import a CSV." |
| Item added (first) | C: "FIRST HIT LOGGED". "Your table is live. Lunar Fox V-Star, NM, $1,240.00." |
| Item added (later) | B: "Logged #0187" + spec block |
| Sale confirmed | C: "SOLD. R-0042". "$1,240.00 cash. Receipt sent to maya@..." |
| Error | "Not saved". "No response after 8 s. Your change is held on this device." [Retry] |

---

## Sileo facts (verified against the docs and the 0.1.6 package source)

- Install: `pnpm add sileo` (pulls `motion@^12.34`). Pin the exact version; it is pre-1.0.
- API: `sileo.success / error / warning / info / action / show(options)` return an id; `sileo.promise(promise, { loading, success, error, action?, position? })`; `sileo.dismiss(id)`; `sileo.clear(position?)`.
- Options: `title`, `description` (ReactNode), `position`, `duration` (default 6000, `null` = sticky), `icon`, `fill` (default `#FFFFFF`), `styles { title, description, badge, button }`, `roundness` (default 16), `autopilot`, `button { title, onClick }`.
- `<Toaster position offset options theme />`. Six positions: top/bottom x left/center/right.
- Source details that matter for us:
  - Default fill is white. We must pass `options={{ fill: "#1C1C2C" }}` (B: `#151622`) and override `[data-sileo-description]` colour (its dark theme sets description text to `rgba(0,0,0,.5)`, unreadable on our fill).
  - `[data-sileo-title]` has `text-transform: capitalize`; override to `none` (B) or `uppercase` (C moments).
  - State colours come from `--sileo-state-success/error/warning/info/action` CSS vars; map them to our `--success #61CB7C`, `--danger #F66C6D`, `--warning #F1CA47`, `--hold #8BBCEF` (info), `--accent #F77C10` (action).
  - Width is `--sileo-width: 350px`, pill height 40 px, header is `white-space: nowrap`. Keep titles under about 30 characters.
  - Hover pauses the timer (mouse only; focus does not pause).
  - The toast root renders as a `<button>` and the action button is rendered inside it (nested interactive content). See accessibility.
  - Viewport is `aria-live="polite"` for every state, including errors.
  - Reduced motion: CSS transitions/animations drop to 0 s under `prefers-reduced-motion`. Wrap the app in Motion's `<MotionConfig reducedMotion="user">` so the JS springs also respect it.
  - Header enter uses `filter: blur(6px)`; acceptable for one element, but do not stack more than 3 visible toasts on mid-range Android.

Global setup (for the implementing agent):

```tsx
<MotionConfig reducedMotion="user">
  <Toaster
    position={isMobile ? "bottom-center" : "top-right"}
    offset={isMobile ? { bottom: 80 } : { top: 72, right: 16 }} // clears the 64px tab bar / 56px header
    options={{ fill: "#151622", roundness: 8, duration: 5000 }}
  />
</MotionConfig>
```

Positions follow UI-SPEC section 7: bottom-center on mobile (above the sticky bar or tab bar), top-right on desktop. In the table below "Std" means that pair.

---

## Toast state map (all 7 phases)

Durations: success 4 to 5 s, info 5 s, warnings 8 s, anything with a button at least 8 s or sticky, errors sticky until dismissed (WCAG 2.2.1). "Promise" means one toast that morphs in place via `sileo.promise`, so a state never stacks two toasts.

### Mechanics

| # | Phase | State | Sileo call | Position | Duration | Button |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 1 | Sign-in link sent | `success` | Std | 6 s | "Resend" (enabled after 30 s) |
| 2 | 1 | Link expired or used | `error` | top-center (login is a single column) | sticky | "Send a new link" |
| 3 | 1 | Store created | `success` (C moment) | Std | 6 s | "Print table sign" |
| 4 | 1 | Slug taken | none: inline field error. Toast only if the check fails on submit: `error` | Std | sticky | none |
| 5 | 1/3 | Settings saved | `success` | Std | 4 s | none |
| 6 | 3 | Item added | `success` (first ever: C moment) | Std | 5 s | "Undo" |
| 7 | 3 | Item updated | `success` | Std | 4 s | none |
| 8 | 3 | Item removed | `action` | Std | 8 s | "Undo" |
| 9 | 3/6 | Qty hits zero | `warning` | Std | 8 s | "Hide item" |
| 10 | 3 | CSV import running / result | `promise` (loading, then success or action) | Std | loading sticky, result 8 s or sticky with errors | "Review 4 rows" when errors |
| 11 | 2/3 | Search limit reached | `warning` | Std | 8 s | none (limit reset time in copy) |
| 12 | 2 | Price sync stale (over 48 h) | `info` once per session, plus inline badge | Std | 6 s | "Details" |
| 13 | 2 | Price sync failed (manual refresh) | `error` | Std | sticky | "Try again" |
| 14 | 5 | Buyer: request sent | `promise` (loading "Sending", then success) | bottom-center (buyer is always mobile-first) | 5 s | none (waiting screen takes over) |
| 15 | 5 | Seller: request received | `action` + sound + vibrate | Std (top-right desktop so it never covers the queue) | 10 s | "Review" |
| 16 | 5 | Buyer: hold expiring (3 min left) | `warning` | bottom-center | 8 s | "Ask for more time" (v1: none) |
| 17 | 5 | Hold expired | `info` (seller), `warning` (buyer) | Std | 6 s | buyer: "Send again" |
| 18 | 5 | Request declined (buyer) | `info` (not error; nothing broke) | bottom-center | 8 s | "Back to the table" |
| 19 | 6 | Sale confirmed | `promise` (loading "Recording", success; C moment) | Std | 6 s | "View receipt" |
| 20 | 6 | Receipt emailed | merged into #19 success description; standalone `success` only on resend | Std | 4 s | none |
| 21 | 6 | Receipt email failed | `warning` (sale is saved; only email failed) | Std | sticky | "Resend" |
| 22 | 7 | Report exported | `success` | Std | 4 s | none |
| 23 | 7 | Promo list exported | `success` | Std | 4 s | none |
| 24 | all | Offline | `promise` keyed on a "back online" promise: loading = offline, success = reconnected | Std | sticky while offline, 4 s after | none (header indicator also shows it) |
| 25 | all | Live connection dropped (SSE) | `warning` | Std | sticky until reconnect | "Check for requests" |
| 26 | all | Generic error | `error` | Std | sticky | "Try again" |
| 27 | all | Copied store link | `success` | Std | 2.5 s | none |

### Copy per direction

Format: title / description. Item names, prices and emails are interpolated.

| # | A: Night market | B: Grading lab | C: Booster rip |
| --- | --- | --- | --- |
| 1 | Check your inbox / We sent a sign-in link to sam@... It works for 15 minutes. | Link sent / To sam@... Valid 15 min. | Link's out / Check sam@... Good for 15 minutes. |
| 2 | That link's gone stale / Links work once, for 15 minutes. Grab a fresh one. | Link expired / Single use, 15 min. Request a new one. | Link expired / Those only last 15 minutes. Get a new one. |
| 3 | Your table's set up / Ridgeline Cards is ready for its first card. | Store created / shoptcg.app/ridgeline is live. 0 items. | YOU'RE OPEN / shoptcg.app/ridgeline is live. Time to stock it. |
| 4 | Someone's got that one / Try ridgeline-cards or add your city. | Slug taken / "ridgeline" is in use. Try "ridgeline-cards". | Taken / "ridgeline" is claimed. Try "ridgeline-cards". |
| 5 | Saved / Your table's updated. | Settings saved / Rule: market -10%, round to 0.50. | Locked in / Settings saved. |
| 6 | On the table / Lunar Fox V-Star, NM. 3 at $1,240.00. | Logged #0187 / Condition NM, Qty 3, $1,240.00, -4.8% vs market | PULLED TO YOUR TABLE / Lunar Fox V-Star x3, $1,240.00 each. |
| 7 | Updated / Lunar Fox V-Star now $1,199.00. | Updated #0187 / Price $1,240.00 to $1,199.00. | Repriced / Lunar Fox V-Star, now $1,199.00. |
| 8 | Taken off the table / Lunar Fox V-Star is hidden from buyers. | Removed #0187 / Lunar Fox V-Star. Undo within 8 s. | Pulled off / Lunar Fox V-Star is gone. Changed your mind? |
| 9 | Last one's gone / Lunar Fox V-Star is out. Keep it listed as sold out, or hide it. | Qty 0 / Lunar Fox V-Star shows as sold out. | SOLD OUT / Lunar Fox V-Star is cleaned out. |
| 10 | Unpacking your list (loading) / 212 of 480 rows... Then: 476 cards on the table / 4 rows need a look. | Importing 212/480 / Then: 476 logged, 4 rejected / Rows 18, 77, 203, 410. | Ripping your CSV (loading) / Then: 476 PULLED / 4 rows snagged. Fix them in a sec. |
| 11 | Slow down a touch / You've hit the search limit. It resets at 14:00. | Limit reached / 100 searches per hour. Resets 14:00. | Easy there / Search cap hit. Back at 14:00. |
| 12 | Prices are a bit old / Last sync was 3 days ago. Your prices still show. | Sync 72 h old / Last market data: 5 Nov 02:00. | Prices are stale / Last sync 3 days ago. |
| 13 | Couldn't reach the price feed / Your current prices stay as they are. | Sync failed / Provider timeout. Existing prices kept. | Sync snagged / Old prices stay put. |
| 14 | Sent to the seller / They'll get back to you at the table. | Request sent / 2 items held for 15:00. | SENT / Your picks are held for 15 minutes. |
| 15 | Maya wants a couple / 2 items, $86.00. Held for 15 minutes. | Request #0042 / Maya R. 2 items $86.00. Hold 15:00 | NEW REQUEST / Maya R. wants 2 items, $86.00. |
| 16 | Still keen? / Your hold ends in 3 minutes. Find the seller at the table. | Hold 02:59 / Items release at 14:32. | 3 MINUTES LEFT / Your hold is almost up. |
| 17 | Hold's over / Those cards are back on the table. | Hold expired #0042 / 2 items returned to stock. | Hold's up / Items are back for grabs. |
| 18 | The seller passed on this one / Ask them at the table, or pick something else. | Request declined #0042 / Items released. | Not this time / The seller passed. Plenty more on the table. |
| 19 | Sold to Maya / Receipt R-0042 is on its way to her inbox. | Sale R-0042 recorded / $1,240.00 cash. Stock 3 to 2. Receipt sent. | SOLD. R-0042 / $1,240.00 in. Receipt flying to Maya. |
| 20 | Receipt sent again / It's in maya@...'s inbox. | Receipt R-0042 resent / To maya@... | Resent / R-0042 is back in Maya's inbox. |
| 21 | The sale's saved, the email isn't / We couldn't reach maya@... Try once more? | Email failed R-0042 / Sale recorded. Delivery to maya@... bounced. | Sale's in, email snagged / Couldn't reach maya@... |
| 22 | Report's ready / Saturday show, 31 sales, $1,412.50. | Exported / report-2026-11-08.csv, 31 rows. | REPORT'S IN / 31 sales, $1,412.50. |
| 23 | List's ready / 48 buyers who said yes to promos. | Exported / customers-optin.csv, 48 rows. | Got 'em / 48 opted-in buyers exported. |
| 24 | You're offline (loading) / Keep selling; we'll catch up when the WiFi's back. Then: Back online / 2 requests caught up. | Offline / Changes queued locally. Then: Online / Synced 2 requests. | OFFLINE / Hang tight. Then: BACK / 2 requests caught up. |
| 25 | Lost the live line / New requests may be late. | Live feed down / Reconnecting. Pull manually below. | Signal dropped / Requests might lag. |
| 26 | That didn't save / The hall WiFi blinked. Your change is still here. | Not saved ERR 504 / No response after 8 s. Edit held on this device. | SNAGGED / That save didn't go through. Nothing's lost. |
| 27 | Link copied / Paste it anywhere. | Copied / shoptcg.app/ridgeline | Copied / Go share it. |

---

## Watermelon UI picks

All verified on 2026-11-08: page returned 200, the install command was read from the live component page and matched the public catalog API, and the registry JSON resolved. All are MIT, built on Motion + Tailwind.

Audit of the registry sources for all of them: **none** reads `prefers-reduced-motion` or `useReducedMotion`, **none** has `aria-*` attributes, and most hard-code neutral Tailwind colours (`bg-neutral-*`, `text-white`). No emoji were found in any of them. Every pick needs the same three edits after install: swap colours to our tokens, add `useReducedMotion` (or rely on the global `MotionConfig reducedMotion="user"`), and add labels/roles.

| Component | Page | Install | Where it goes | Notes |
| --- | --- | --- | --- | --- |
| Stepper | https://ui.watermelon.sh/animated-components/stepper | `npx shadcn@latest add https://registry.watermelon.sh/r/stepper.json` | Inventory row qty and the buyer list qty | Rolling-digit spring fits B. Uses `react-icons`; swap to lucide. Add `aria-label` and live value. |
| Time Undo Action | https://ui.watermelon.sh/animated-components/time-undo-action | `npx shadcn@latest add https://registry.watermelon.sh/r/time-undo-action.json` | Inventory: remove item (inline undo with countdown), Decline request | Pairs with toast #8. Uses `react-use-measure` and 12 blur usages: trim the blur. |
| List Stack | https://ui.watermelon.sh/animated-components/list-stack | `npx shadcn@latest add https://registry.watermelon.sh/r/list-stack.json` | Dashboard request queue: "Expired today (3)" collapsed group | Good for the collapsed group only, not the live queue. |
| Labeled Progress Indicator | https://ui.watermelon.sh/animated-components/labeled-progress-indicator | `npx shadcn@latest add https://registry.watermelon.sh/r/labeled-progress-indicator.json` | CSV import preview and progress (phase 3) | Small (90 lines, motion only). Add `role="progressbar"` + `aria-valuenow`. |
| Continuous Tabs | https://ui.watermelon.sh/animated-components/continuous-tabs | `npx shadcn@latest add https://registry.watermelon.sh/r/continuous-tabs.json` | Store page filters (Raw / Graded / Sealed), inventory filter chips | Sliding pill. Needs `role="tablist"` or `aria-pressed` chips per UI-SPEC. |
| Filter Disclosure | https://ui.watermelon.sh/animated-components/filter-disclosure | `npx shadcn@latest add https://registry.watermelon.sh/r/filter-disclosure.json` | Store page language filter (EN / JP / CN) on mobile | Optional; Continuous Tabs may cover it. |
| Transaction List | https://ui.watermelon.sh/animated-components/transaction-list | `npx shadcn@latest add https://registry.watermelon.sh/r/transaction-list.json` | Reports (phase 7): sales list with expandable line items | 37 hard-coded colours to swap. Strong fit for the end-of-show report. |
| Send Money | https://ui.watermelon.sh/animated-components/send-money | `npx shadcn@latest add https://registry.watermelon.sh/r/send-money.json` | Seller confirm sale (phase 6): confirm, status, done states | **Heavy**: 360 lines, 75 hard-coded colours, 12 blur usages. Use as a motion reference, rebuild with our tokens. |
| Run Widget | https://ui.watermelon.sh/animated-components/run-widget | `npx shadcn@latest add https://registry.watermelon.sh/r/run-widget.json` | Reports headline total and the dashboard "Today: 6 sales, $412.50" line | Adds `@number-flow/react` (new dep). Avoid the hero-metric template; one number in a sentence. |
| Pagination | https://ui.watermelon.sh/animated-components/pagination | `npx shadcn@latest add https://registry.watermelon.sh/r/pagination.json` | Desktop inventory table paging | Rolling page digits match B. Optional. |

Flagged as off-brand or not recommended (all verified to exist):

- Shimmer Button (https://ui.watermelon.sh/animated-components/shimmer-button, `npx shadcn@latest add https://registry.watermelon.sh/r/shimmer-button.json`): shimmer on the CTA conflicts with the guardrail "holo on card art only, never on UI chrome". Skip.
- Revealing Cards (https://ui.watermelon.sh/animated-components/revealing-cards, `npx shadcn@latest add https://registry.watermelon.sh/r/revealing-cards.json`): depends on `framer-motion`, not `motion`. That would put two animation runtimes in the bundle next to Sileo. Skip.
- Card Swipe (https://ui.watermelon.sh/animated-components/card-swipe): gesture card stack, tempting for the store page, but pulls `next-themes` and `@hugeicons/*`, and swipe is explicitly ruled out in SCREENS.md (discoverability). Skip.

Not verified: nothing in the table above is unverified. Visual quality was judged from the catalog descriptions and registry source, not from interacting with each live demo.

---

## Accessibility

**Reduced motion.**
- Global: `<MotionConfig reducedMotion="user">` at the root so Sileo and every Watermelon component drop transform animations. Sileo's own CSS already zeroes transitions under `prefers-reduced-motion: reduce`.
- Toasts still appear and disappear (opacity only, up to 120 ms). The gooey morph, foil sweep, error nudge, ruler ticks, string-light flicker, hero slam and card rise are all off. The mockups implement this: the spring helper jumps to its end value and the CSS keyframes are wrapped in `prefers-reduced-motion: no-preference`.
- Sound and vibration for the seller ping are not motion; they stay, with the mute toggle from UI-SPEC.

**Live regions.**
- Sileo's viewport is `aria-live="polite"` for every state. Keep that for success, info and warning.
- For errors (#2, #13, #21, #25, #26) also write the message into one app-owned visually hidden `role="alert"` region, so it is announced assertively. The mockups do this (`#sr-alert`).
- Request received (#15) must not rely on the toast: the queue row itself gets the "New" label, and the page title count changes ("(1) Requests").

**Focus and keyboard.**
- Toasts never steal focus.
- Sileo renders the toast as a `<button>` with the action `<button>` nested inside it (invalid nesting; screen readers may read it as one control). Until upstream fixes it, every toast action must also exist in the page: Undo on the row, Retry inline next to the failed field, "Review" on the queue row. The toast button is a shortcut, never the only path.
- Sileo pauses on mouse hover only. Toasts with buttons are at least 8 s or sticky so keyboard and screen-reader users have time; errors are sticky.
- Escape should dismiss the most recent toast (wire `sileo.dismiss(lastId)` on a keydown listener; not built into Sileo).

**Contrast.** Toast fills `#151622` to `#20160F` are within 1 percent luminance of `surface`, so UI-SPEC section 2.3 ratios hold: success on surface 9.18, danger 6.46, warning 11.78, muted description text 9.64. Override Sileo's description colour (its built-in dark theme uses `rgba(0,0,0,.5)`). The badge tint is `color-mix(state 18%, transparent)` behind a full-strength glyph; the glyph is the meaningful part and keeps its ratio. State is never colour-only: every toast has an icon plus a text title.

**Copy.** Titles under about 30 characters (Sileo header is single-line). No em dashes, no emoji. Errors say what happened to the user's data first.

---

## Files

- `direction-a.html`, `direction-b.html`, `direction-c.html`: self-contained (Archivo latin inlined, no network). Same slice in each: landing hero, one inventory row, a success toast and an error toast. Click "Try again" / "Retry" on the error toast to see it morph through loading into success. "Replay toasts" reruns the sequence. Toasts sit top-right on desktop and bottom-center under 768 px.
- `shots/direction-{a,b,c}-{390,1280}.png`: captured 2.3 s after load, mid-toast.
- `gen.mjs`: regenerates the three HTML files (reads the Archivo woff2 from `.next/static/media`, so run after a build). `shot.cjs`: Playwright screenshots.
- The toast engine in the mockups is an approximation of Sileo (pill and body rects under one SVG goo filter, driven by a small spring). Real Sileo will look close but not identical.
