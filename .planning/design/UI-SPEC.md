# shoptcg.app UI spec: design system

Status: draft for review. Source of truth for product context: `.planning/PROJECT.md` (no PRODUCT.md exists; PROJECT.md stands in for it). Screen-by-screen specs live in `SCREENS.md`. Mockups live in `mockups/`.

Rules carried from `agent.md`: no emoji anywhere (UI, copy, email, icons). Icons are inline SVG (lucide via shadcn is fine) or text labels.

## 1. Scene and register

Scene: a buyer stands at a folding table in a fluorescent-lit convention hall, phone at arm's length with glare across the screen, deciding in twenty seconds whether a $40 card is fair; the seller glances at a phone propped against the cash box between conversations, one hand holding a slab.

What that forces:

- Dark theme (owner's brand) but tuned for glare: body text near 18:1, nothing that carries meaning below 7:1 except disabled states. No thin weights (minimum 400 body, 600 for anything numeric).
- Prices are the second hero after card art: big, tabular, near-white. Orange is never used for prices; orange means "you can tap this".
- Tap targets 44px minimum, 48px for primary actions. One-handed: primary actions sit in the bottom third on mobile.
- No reliance on colour alone: every state (on hold, below market, sold out, open/closed, live/offline) has a text label and usually an icon.
- Register: product (app UI). Exceptions: the landing page and the QR table sign are brand surfaces and may push type scale harder.

Colour strategy: Restrained. Tinted galaxy-black neutrals carry 85%+ of every screen, seal grey carries structure and secondary text, sunrise orange stays under 10% (primary action, active filter, focus ring, live ping). Card art supplies the rest of the colour.

## 2. Colour tokens

All scales generated in OKLCH (lightness steps fixed, chroma tapered at the extremes, hue locked) then converted to sRGB hex. Generator: hue 282 for galaxy, 255 for seal, 52 for sunrise.

### 2.1 Brand scales

| Step | galaxy (primary, black) | seal (secondary, grey) | sunrise (accent, orange) |
| --- | --- | --- | --- |
| 50 | `#F2F3F9` | `#F3F5F8` | `#FFF1E6` |
| 100 | `#E4E5F0` | `#E5E8EC` | `#FFDFCA` |
| 200 | `#CBCCDF` | `#D1D5D9` | `#FFC49E` |
| 300 | `#A9ABC7` | `#B6BBC1` | `#FFA86F` |
| 400 | `#8183A4` | `#9A9FA6` | `#FF9044` |
| 500 | `#5E6081` | `#7E848B` | `#F77C10` |
| 600 | `#434561` | `#646970` | `#DB6500` |
| 700 | `#2D2E44` | `#4B5056` | `#B45000` |
| 800 | `#1C1C2C` | `#373B40` | `#8E3D00` |
| 900 | `#11121C` | `#26292E` | `#6A2F00` |
| 950 | `#090911` | `#181B1E` | `#471E00` |

Brand anchors: galaxy black = `galaxy-950 #090911`, seal grey = `seal-500 #7E848B` (UI uses 300 to 700), sunrise orange = `sunrise-500 #F77C10`.

Galaxy is a black with a faint violet-blue cast (night sky, not pure #000). Seal is a cool slate grey, deliberately a different hue from galaxy so borders and secondary text read as "metal" against "space".

### 2.2 Semantic tokens (dark, the only app theme in v1)

| Token | Value | Use |
| --- | --- | --- |
| `bg` | galaxy-950 `#090911` | page |
| `surface` | galaxy-900 `#11121C` | cards, list rows, sheets |
| `surface-2` | galaxy-800 `#1C1C2C` | raised: inputs, active row, sticky bars |
| `surface-3` | galaxy-700 `#2D2E44` | hover on surface-2, pressed chips |
| `border` | seal-800 `#373B40` | decorative dividers (no contrast requirement) |
| `border-strong` | seal-600 `#646970` | input and control outlines (3:1 non-text) |
| `text` | seal-50 `#F3F5F8` | body, prices, headings |
| `muted` | seal-300 `#B6BBC1` | secondary text, set names, second currency |
| `subtle` | seal-400 `#9A9FA6` | timestamps, helper text (still AA) |
| `disabled` | seal-600 `#646970` | disabled text only (exempt from AA) |
| `accent` | sunrise-500 `#F77C10` | primary buttons, active filter, live ping |
| `accent-hover` | sunrise-400 `#FF9044` | hover/pressed primary |
| `on-accent` | galaxy-950 `#090911` | text/icons on accent (dark on orange, not white) |
| `accent-text` | sunrise-400 `#FF9044` | orange text links on dark |
| `accent-bg` | `#3D1D06` | tinted accent wash (new request highlight) |
| `focus` | sunrise-400 `#FF9044` | 2px focus ring, 2px offset |
| `success` / `success-bg` | `#61CB7C` / `#122D19` | confirmed sale, open store, live connection |
| `warning` / `warning-bg` | `#F1CA47` / `#322807` | hold expiring, stale price, reconnecting |
| `danger` / `danger-bg` | `#F66C6D` / `#3F1919` | errors, decline, destructive |
| `hold` / `hold-bg` | `#8BBCEF` / `#172839` | "On hold" state (frost blue, never orange) |
| `deal` / `deal-bg` | `#5CDDC4` / `#062D26` | below-market badge (mint, distinct from success green) |

Hue map is deliberate: orange = action, green = done/open, yellow = time pressure, red = error, frost blue = held by someone else, mint = good deal. Sunrise orange and danger red sit 30 degrees apart in hue, so danger always carries an icon and text.

### 2.3 Contrast (WCAG 2.x, computed from the hex values above)

| Pair | Ratio | AA requirement | Result |
| --- | --- | --- | --- |
| text on bg | 18.16 | 4.5 | pass (AAA) |
| text on surface-2 | 15.36 | 4.5 | pass (AAA) |
| muted on bg | 10.26 | 4.5 | pass (AAA) |
| muted on surface | 9.64 | 4.5 | pass (AAA) |
| muted on surface-2 | 8.68 | 4.5 | pass (AAA) |
| subtle on surface | 6.99 | 4.5 | pass |
| accent on bg (orange text/icon) | 7.41 | 4.5 | pass (AAA) |
| accent on surface-2 | 6.27 | 4.5 | pass |
| on-accent on accent (button label) | 7.41 | 4.5 | pass (AAA) |
| on-accent on accent-hover | 8.81 | 4.5 | pass (AAA) |
| accent-text on surface | 8.27 | 4.5 | pass (AAA) |
| sunrise-300 on accent-bg | 8.05 | 4.5 | pass (AAA) |
| success on surface | 9.18 | 4.5 | pass |
| warning on surface | 11.78 | 4.5 | pass |
| danger on surface | 6.46 | 4.5 | pass |
| hold on surface | 9.35 | 4.5 | pass |
| deal on surface | 11.17 | 4.5 | pass |
| success on success-bg | 7.31 | 4.5 | pass |
| warning on warning-bg | 9.21 | 4.5 | pass |
| danger on danger-bg | 5.34 | 4.5 | pass |
| hold on hold-bg | 7.53 | 4.5 | pass |
| deal on deal-bg | 8.93 | 4.5 | pass |
| border-strong on surface (control edge) | 3.37 | 3.0 non-text | pass |
| focus ring on bg | 8.81 | 3.0 non-text | pass |
| Print/email: galaxy-950 on white | 19.83 | 4.5 | pass |
| Print/email: sunrise-700 on seal-50 (links) | 4.70 | 4.5 | pass |

Never put white text on sunrise-500 (2.6:1, fails). Never use seal-700 or darker for text.

### 2.4 Light contexts (email receipt, printed QR sign)

Email and print are light because email clients mangle dark backgrounds and home printers mangle toner-heavy pages. Use: bg `#FFFFFF`, panel seal-50 `#F3F5F8`, text galaxy-950 `#090911`, muted seal-700 `#4B5056` (7.9:1 on white), links and the orange rule sunrise-700 `#B45000`. Orange appears as a solid rule or block, not as body text.

## 3. Typography

One family: **Archivo** (Google Fonts, variable, axes `wght 100..900`, `wdth 62..125`, has `tnum`). Verified: the Google Fonts woff2 ships `tnum`, `pnum`, `frac`, `numr`, `dnom`. The width axis gives a "grading label" voice for headings (expanded) and a compact voice for dense seller tables (condensed) without a second download.

```ts
// src/app/fonts.ts
import { Archivo } from "next/font/google";
export const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});
```

CJK: Japanese and Chinese card names fall back to system fonts (`"Hiragino Sans", "Yu Gothic UI", "Noto Sans CJK JP", "PingFang SC", "Microsoft YaHei"`). Do not load a CJK webfont; it would blow the 2.5s LCP budget. Set `lang="ja"` / `lang="zh"` on the name element so the OS picks the right glyph variants.

### 3.1 Scale (fixed rem, product register)

| Token | Size / line | Weight | Width | Use |
| --- | --- | --- | --- | --- |
| `text-xs` | 13 / 16 | 600 | 100 | badges, uppercase labels (tracking 0.06em) |
| `text-sm` | 14 / 20 | 400-500 | 100 | meta: set, number, timestamps |
| `text-base` | 16 / 24 | 400 | 100 | body, inputs (16px stops iOS zoom) |
| `text-lg` | 18 / 26 | 600 | 100 | card names on detail, row titles |
| `text-xl` | 22 / 28 | 700 | 108 | section headings, tile price |
| `text-2xl` | 28 / 32 | 700 | 112 | page titles, store name |
| `text-3xl` | 36 / 40 | 700 | 112 | item detail price, totals |
| `text-display` | 52 / 54 | 800 | 118 | landing hero, QR sign store name |

Headings: `letter-spacing: -0.01em`, `text-wrap: balance`. Body prose max 68ch.

### 3.2 Price style

Every price, quantity, timer, total and receipt number uses `.num`:

```css
.num {
  font-variant-numeric: tabular-nums lining-nums;
  font-feature-settings: "tnum" 1, "lnum" 1;
  font-weight: 700;
  font-variation-settings: "wdth" 100;
  letter-spacing: 0;
}
.num-currency { font-weight: 500; color: var(--color-muted); margin-right: 0.08em; }
.num-cents { font-size: 0.72em; vertical-align: 0.28em; font-weight: 600; } /* tiles only, not tables or receipts */
```

Formatting: `Intl.NumberFormat` with the currency code. USD shows `$42.00`; second currency shows as `approx. A$64` (rounded to whole units, muted, one step smaller). In tables and receipts, cents are never raised; columns right-align.

## 4. Spacing, radii, elevation

Spacing: Tailwind v4 default `--spacing: 0.25rem` (4px base). Rhythm used: 4, 8, 12, 16, 24, 32, 48, 64. Page gutter 16px mobile, 24px tablet, 32px desktop. Content max width 1200px (store), 1280px (dashboard).

Radii:

| Token | Value | Use |
| --- | --- | --- |
| `radius-sm` | 6px | badges, chips |
| `radius-md` | 10px | buttons, inputs, list rows |
| `radius-lg` | 16px | sheets, panels |
| `radius-card` | `4.6% / 3.3%` (percent of the box, so it scales; the token `--radius-card: 6px` is the fixed fallback) | card art, matches the real 63 x 88 mm card corner (about 2.9mm) |

Card art aspect: raw `63 / 88`; graded slab `3 / 5`; sealed `1 / 1` with `object-fit: contain` on a surface-2 well.

Elevation on dark comes from lighter surfaces plus a 1px top highlight, not drop shadows:

| Level | Recipe |
| --- | --- |
| 0 | `bg` |
| 1 | `surface` + `box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.04)` |
| 2 | `surface-2` + `inset 0 1px 0 rgb(255 255 255 / 0.06)`, `0 1px 2px rgb(0 0 0 / 0.4)` |
| 3 (sheets, toasts) | `surface-2` + `0 16px 48px -12px rgb(0 0 0 / 0.7)`, `inset 0 1px 0 rgb(255 255 255 / 0.08)` |

No glassmorphism. Sticky bars use solid `surface-2` with a top border, not blur (blur is expensive on mid-range Android).

## 5. Motion

| Token | Value |
| --- | --- |
| `dur-fast` | 120ms (press, toggle) |
| `dur-base` | 200ms (sheet, chip, row state) |
| `dur-slow` | 320ms (new-request entrance, holo sweep start) |
| `ease-out` | `cubic-bezier(0.25, 1, 0.5, 1)` (quart) |
| `ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` |

Rules:

- Animate `transform` and `opacity` only. Never width, height, top, margin.
- Motion conveys state: add to list (button morphs to a check for 900ms, list bar count ticks), new request (slides 12px down from top + accent ring pulses twice), hold timer (no animation, number only), sale confirmed (one holo sweep across the bought card, once).
- No page-load choreography. No bounce, no elastic.
- `@media (prefers-reduced-motion: reduce)`: all transitions drop to opacity only at 1ms to 120ms; ring pulse becomes a static accent outline plus "New" label that persists until opened; holo sweep becomes a static sheen. Sound and vibration for the seller ping stay (they are not motion), with a mute toggle.

## 6. Holo shimmer recipe

Used sparingly, three places only: (1) item detail hero art, on pointer/touch move; (2) graded slab hero on item detail; (3) the "sale confirmed" moment, one sweep over the purchased card on the buyer's screen. Never on store-grid tiles (cost on mid-range phones and visual noise when 30 tiles shimmer).

```css
.holo {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border-radius: var(--radius-card);
  --holo-x: 50%;
  --holo-y: 50%;
}
.holo::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(farthest-corner circle at var(--holo-x) var(--holo-y),
      rgb(255 255 255 / 0.35) 0%, rgb(255 255 255 / 0) 45%),
    repeating-linear-gradient(115deg,
      oklch(0.80 0.12 30 / 0.55) 0%, oklch(0.85 0.12 95 / 0.55) 6%,
      oklch(0.82 0.11 165 / 0.55) 12%, oklch(0.78 0.12 250 / 0.55) 18%,
      oklch(0.78 0.13 320 / 0.55) 24%, oklch(0.80 0.12 30 / 0.55) 30%);
  background-size: 100% 100%, 300% 300%;
  background-position: center, var(--holo-x) var(--holo-y);
  mix-blend-mode: color-dodge;
  opacity: 0;
  transition: opacity var(--dur-base) var(--ease-out);
}
.holo[data-holo="on"]::after { opacity: 0.45; }

/* one-shot sweep for the confirmed-sale moment */
.holo[data-holo="sweep"]::after { animation: holo-sweep 1400ms var(--ease-out-expo) 1 both; }
@keyframes holo-sweep {
  0%   { opacity: 0;    background-position: center, 0% 0%; }
  30%  { opacity: 0.5; }
  100% { opacity: 0;    background-position: center, 100% 100%; }
}

@media (prefers-reduced-motion: reduce) {
  .holo::after { transition: none; }
  .holo[data-holo="sweep"]::after { animation: none; opacity: 0.25; }
}
```

JS (item detail only, about 10 lines): on `pointermove` set `--holo-x/--holo-y` from the pointer position as percentages and set `data-holo="on"`; on `pointerleave` remove it. Throttle with `requestAnimationFrame`. No device-orientation listener in v1 (iOS needs a permission prompt; not worth it).

## 7. Component vocabulary (shadcn/ui mapping)

| Component | Spec |
| --- | --- |
| Button primary | bg `accent`, text `on-accent`, 48px tall mobile, `radius-md`, weight 700. Hover/pressed `accent-hover`. Loading: label stays, spinner replaces leading icon, `aria-busy`. |
| Button secondary | bg `surface-2`, 1px `border-strong`, text `text`. |
| Button ghost | text `muted`, hover bg `surface-3`. |
| Button destructive | bg `danger-bg`, text `danger`, 1px `danger` at 40% alpha. |
| Input | bg `surface-2`, 1px `border-strong`, 48px, 16px text. Focus: 2px `focus` ring. Error: border `danger`, message below in `danger` with icon, `aria-describedby`. |
| Chip (filter) | 36px visual, 44px hit area. Off: `surface-2` + `muted`. On: `accent-bg` bg, 1px `accent`, text `sunrise-200`. `aria-pressed`. |
| Badge | `text-xs` uppercase, `radius-sm`, tinted bg + matching fg from the semantic pairs. Always text, optional 12px icon. |
| Tile (store grid) | No container card: art, then text directly on `bg`. Name 2-line clamp, meta, price, stock, add button 44px. |
| Sheet | bottom sheet on mobile for cart and filters; side panel on desktop. Not a centered modal. |
| Toast | bottom on mobile above the sticky bar, top-right desktop, level 3, auto-dismiss 5s except errors. |
| Skeleton | `surface` blocks with a 1.2s opacity pulse (0.6 to 1); static under reduced motion. |

Icons: lucide (ships with shadcn), 20px, 1.75 stroke. No emoji, no icon fonts.

## 8. tokens.css (paste into `src/styles/tokens.css`)

Tailwind v4: raw scales go in `@theme` (generates `bg-galaxy-950`, `text-sunrise-500` etc.). Semantic tokens follow the shadcn v4 convention (`:root` vars, mapped through `@theme inline`) so shadcn components pick them up. Note the shadcn mapping: shadcn `--primary` is the main button colour, so it maps to sunrise orange; the brand "primary" colour, galaxy black, is `--background`.

```css
/* src/styles/tokens.css. Import after `@import "tailwindcss";` */

@theme {
  /* galaxy: primary brand, black */
  --color-galaxy-50: #F2F3F9;
  --color-galaxy-100: #E4E5F0;
  --color-galaxy-200: #CBCCDF;
  --color-galaxy-300: #A9ABC7;
  --color-galaxy-400: #8183A4;
  --color-galaxy-500: #5E6081;
  --color-galaxy-600: #434561;
  --color-galaxy-700: #2D2E44;
  --color-galaxy-800: #1C1C2C;
  --color-galaxy-900: #11121C;
  --color-galaxy-950: #090911;

  /* seal: secondary brand, grey */
  --color-seal-50: #F3F5F8;
  --color-seal-100: #E5E8EC;
  --color-seal-200: #D1D5D9;
  --color-seal-300: #B6BBC1;
  --color-seal-400: #9A9FA6;
  --color-seal-500: #7E848B;
  --color-seal-600: #646970;
  --color-seal-700: #4B5056;
  --color-seal-800: #373B40;
  --color-seal-900: #26292E;
  --color-seal-950: #181B1E;

  /* sunrise: accent brand, orange */
  --color-sunrise-50: #FFF1E6;
  --color-sunrise-100: #FFDFCA;
  --color-sunrise-200: #FFC49E;
  --color-sunrise-300: #FFA86F;
  --color-sunrise-400: #FF9044;
  --color-sunrise-500: #F77C10;
  --color-sunrise-600: #DB6500;
  --color-sunrise-700: #B45000;
  --color-sunrise-800: #8E3D00;
  --color-sunrise-900: #6A2F00;
  --color-sunrise-950: #471E00;

  /* type */
  --font-sans: var(--font-archivo), ui-sans-serif, system-ui, -apple-system, "Segoe UI",
    "Hiragino Sans", "Yu Gothic UI", "Noto Sans CJK JP", "PingFang SC", "Microsoft YaHei", sans-serif;
  --text-xs: 0.8125rem;   --text-xs--line-height: 1rem;
  --text-sm: 0.875rem;    --text-sm--line-height: 1.25rem;
  --text-base: 1rem;      --text-base--line-height: 1.5rem;
  --text-lg: 1.125rem;    --text-lg--line-height: 1.625rem;
  --text-xl: 1.375rem;    --text-xl--line-height: 1.75rem;
  --text-2xl: 1.75rem;    --text-2xl--line-height: 2rem;
  --text-3xl: 2.25rem;    --text-3xl--line-height: 2.5rem;
  --text-display: 3.25rem; --text-display--line-height: 3.375rem;

  /* radii */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-card: 6px;

  /* motion */
  --ease-out: cubic-bezier(0.25, 1, 0.5, 1);
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --dur-fast: 120ms;
  --dur-base: 200ms;
  --dur-slow: 320ms;

  /* elevation */
  --shadow-1: inset 0 1px 0 rgb(255 255 255 / 0.04);
  --shadow-2: inset 0 1px 0 rgb(255 255 255 / 0.06), 0 1px 2px rgb(0 0 0 / 0.4);
  --shadow-3: inset 0 1px 0 rgb(255 255 255 / 0.08), 0 16px 48px -12px rgb(0 0 0 / 0.7);
}

:root {
  color-scheme: dark;

  /* semantic (app is dark-only in v1) */
  --bg: #090911;
  --surface: #11121C;
  --surface-2: #1C1C2C;
  --surface-3: #2D2E44;
  --border: #373B40;
  --border-strong: #646970;
  --text: #F3F5F8;
  --muted: #B6BBC1;
  --subtle: #9A9FA6;
  --disabled: #646970;
  --accent: #F77C10;
  --accent-hover: #FF9044;
  --on-accent: #090911;
  --accent-text: #FF9044;
  --accent-bg: #3D1D06;
  --focus: #FF9044;
  --success: #61CB7C;  --success-bg: #122D19;
  --warning: #F1CA47;  --warning-bg: #322807;
  --danger: #F66C6D;   --danger-bg: #3F1919;
  --hold: #8BBCEF;     --hold-bg: #172839;
  --deal: #5CDDC4;     --deal-bg: #062D26;

  /* shadcn v4 names */
  --background: var(--bg);
  --foreground: var(--text);
  --card: var(--surface);
  --card-foreground: var(--text);
  --popover: var(--surface-2);
  --popover-foreground: var(--text);
  --primary: var(--accent);
  --primary-foreground: var(--on-accent);
  --secondary: var(--surface-2);
  --secondary-foreground: var(--text);
  --muted-foreground: var(--muted);
  --accent-foreground: var(--text); /* shadcn "accent" = hover wash */
  --destructive: var(--danger);
  --input: var(--border-strong);
  --ring: var(--focus);
  --radius: 10px;
}

@theme inline {
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-surface-2: var(--surface-2);
  --color-surface-3: var(--surface-3);
  --color-border: var(--border);
  --color-border-strong: var(--border-strong);
  --color-text: var(--text);
  --color-muted: var(--muted);
  --color-subtle: var(--subtle);
  --color-disabled: var(--disabled);
  --color-accent: var(--accent);
  --color-accent-hover: var(--accent-hover);
  --color-on-accent: var(--on-accent);
  --color-accent-text: var(--accent-text);
  --color-accent-bg: var(--accent-bg);
  --color-focus: var(--focus);
  --color-success: var(--success);  --color-success-bg: var(--success-bg);
  --color-warning: var(--warning);  --color-warning-bg: var(--warning-bg);
  --color-danger: var(--danger);    --color-danger-bg: var(--danger-bg);
  --color-hold: var(--hold);        --color-hold-bg: var(--hold-bg);
  --color-deal: var(--deal);        --color-deal-bg: var(--deal-bg);

  /* shadcn */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-input: var(--input);
  --color-ring: var(--ring);
}

@layer base {
  html { background: var(--bg); color: var(--text); font-family: var(--font-sans); -webkit-text-size-adjust: 100%; }
  :focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
  ::selection { background: var(--accent); color: var(--on-accent); }
}

@utility num {
  font-variant-numeric: tabular-nums lining-nums;
  font-feature-settings: "tnum" 1, "lnum" 1;
  font-weight: 700;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
}
```

Name clash note: shadcn uses `muted` as a background and `muted-foreground` as text. In this system `--color-muted` is the secondary text colour (`text-muted`). If a shadcn component uses `bg-muted`, replace it with `bg-surface-2`.

## 9. Brand guardrails

- No Pokeball shapes, no red/white split circles, no yellow-and-blue wordmark styling, no pocket-monster silhouettes, no official card-back pattern. The wordmark is plain Archivo expanded 800: `shoptcg` in `text`, `.app` in `muted`.
- Card images come from pokemontcg.io / TCGdex as data; never reuse them in marketing or the sign.
- Holo shimmer is our motif, applied to card art only, never to UI chrome or text.

## 10. Mockup critique log (impeccable critique, one iteration)

Screenshots: `mockups/shots/{store,dashboard,sign}-{390,1280}.png` (full-page captures, so fixed bars appear mid-image).

Round 1 findings and fixes:

| Sev | Screen | Issue | Fix applied |
| --- | --- | --- | --- |
| P1 | Store | Prices drifted right inside the tile (flex `align-self:end`), breaking the scan line of numbers. | Prices left-aligned on a common edge. |
| P1 | Store | Below-market badge sat above the name, so names in the same row started at different heights. | Badge moved onto the art, bottom-left; text rows now align. |
| P2 | Store | Currency toggle forced the store name to wrap at 390px. | Toggle moved to the meta row. |
| P2 | Store | Condition (NM/LP) was truncated by the one-line set line. | Meta allows two lines. |
| P2 | Store | JP tag hidden under the on-hold hatch. | Tag stacks above the overlay. |
| P2 | Dashboard | Install nudge pushed the new request below the fold. | Nudge moved below the queue; requests always first. |
| P3 | Desktop store | Floating list panel can cover the last row. | Extra bottom padding; app build should use a side panel per SCREENS.md. |

Still open for the build: placeholder art is uniformly grey, so the "vault" richness depends on real card images (expected); the request code could be larger on the seller side if buyers and sellers mismatch in testing. AI-slop check: no gradient text, no glass, no hero metrics, no side-stripe borders; tiles are art-led rather than an icon-card grid.

## Orchestrator review notes (apply when building)
- Table sign: replace "Live prices / Synced nightly" with "Market-checked prices / Updated daily".
- Table sign: NFC line "Or tap your phone here" only when the vendor enables an NFC toggle in store settings.
- Store page and dashboard: reserve bottom padding equal to the sticky cart bar / bottom nav height so the last row is never covered.

## Personality decision (owner, 2026-11-08)
Direction B "Grading lab" is the base for every screen (slab labels, cert-stamp toasts, precise copy, no overshoot). Direction C "Booster rip" celebration is used only for three moments: store created, first item added, sale confirmed. Toasts via Sileo; animated components via Watermelon UI (verified picks in `personality/PERSONALITY.md`). Every toast action must also exist on the page (Sileo action button is nested; errors announce politely).
