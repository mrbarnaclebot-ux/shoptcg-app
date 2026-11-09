# Store states: open, paused, not vending

## Data
- `store.state` text `open | paused | off` (check constraint), default `paused`.
- `store.paused_until`, `store.opened_at` timestamptz.
- Migration 0015 adds them and maps `is_open` true → open (fresh 14 h window),
  false → paused. `is_open` stays in this release, unread: the previous deploy
  keeps serving while this one migrates and boots, and it still reads that column.
- **Follow-up, the release after this one:** a migration that drops `is_open`,
  and the schema line and `getStoreByOwner`'s exclusion go with it.

### Dropping or renaming a column (any future migration)
`pnpm db:migrate && pnpm start` runs the new migrations while the old deploy is
still serving. So a drop or rename takes two releases: first stop reading the
column (keep it, with its default), then drop it once that release is live.
Adding a column with a default, or a table, is safe in one.

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
  "N buyers are waiting. Their holds still run out on time. Confirm or decline them first."
  when any real (non-test) requests are pending. Pause offers 15 min, 1 hour, Until I
  reopen, and stays offered while paused, to switch length directly. "Keep it …" /
  "Stay not vending" backs out and gets focus. A choice closes the ask at once and
  the controls are disabled until the save lands; focus moves to the state heading.
- Toast for each state. The header status shows Open, Paused or Not vending.
- Public page when paused: stock visible, "Browsing only." banner, "Back in about N min."
  if timed, no list bar.
- Not vending: name, status, message, Terms, noindex. The store, item and list URLs all
  answer 200 with the message (the `?src=sign` QR and saved links shouldn't read as gone).
- The store, item and list pages re-read themselves with `RefreshAt` when the timer
  flips the state; closed pages also poll every 60 s, so a buyer sees the store reopen
  without reloading.
- Waiting requests can be confirmed in every state, off included: the buyer is at the table.

## Choices / limits
- No live stream to buyers. An open page that gets paused while a buyer browses
  finds out when they send (closed copy).
- No logo: no upload exists and nothing renders one today.
- `e2e_pause_ms` cookie shortens timed pauses, honoured only when `seedAllowed`.
- Auto-pause at 14 h is proven by unit tests (13h59 / 14h01), not e2e.
