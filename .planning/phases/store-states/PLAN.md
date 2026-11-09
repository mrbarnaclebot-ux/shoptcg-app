# Store states: open, paused, not vending

## Data
- `store.state` text `open | paused | off` (check constraint), default `paused`.
- `store.paused_until`, `store.opened_at` timestamptz.
- Migration 0015 adds them and maps `is_open` true → open (fresh 14 h window),
  false → paused. 0016 drops `is_open`. Two steps so drizzle-kit never asks
  about a rename.

## The live state is computed on read, never by a job
`src/lib/store-state.ts` holds one SQL `case`, like `effectiveStatus` for requests:
- `off` → off, timers ignored.
- `open` and opened < 14 h ago → open; older → paused (auto-pause).
- `paused` with `paused_until` passed and < 14 h ago → open; otherwise paused.
Also `resumesInMin`, `changesInMs` (when the timer next flips the state) and `autoPaused`.
`createRequest` checks the same expression, so a send is refused whenever
the page would say paused or off. Test requests still go through.

## UI
- Dashboard `StoreControl`: the largest block, paper when open, outline otherwise.
  "Open store" is one tap. "Pause" and "Not vending" open a short ask, which shows
  "N buyers are waiting. Their holds stay until you confirm or decline." when any are pending.
  Pause offers 15 min, 1 hour, Until I reopen. "Keep it …" backs out and gets focus.
- Toast for each state. The header status shows Open, Paused or Not vending.
- Public page when paused: stock visible, "Browsing only." banner, "Back in about N min."
  if timed, no list bar.
- Not vending: name, status, message, Terms, noindex. The store, item and list URLs all
  answer 200 with the message (the `?src=sign` QR and saved links shouldn't read as gone).
- Pages re-read themselves with `RefreshAt` when the timer flips the state; closed
  pages also poll every 60 s, so a buyer sees the store reopen without reloading.

## Choices / limits
- No live stream to buyers. An open page that gets paused while a buyer browses
  finds out when they send (closed copy).
- No logo: no upload exists and nothing renders one today.
- `e2e_pause_ms` cookie shortens timed pauses, honoured only when `seedAllowed`.
- Auto-pause at 14 h is proven by unit tests (13h59 / 14h01), not e2e.
