# components

Shared UI used by more than one route. Visual language: "Show floor, after dark" (`.planning/design/variations/v3-showfloor`). Two materials: the hall (default) and paper (add `.paper`; every token re-binds).

- `ui/`: shadcn primitives (input, label), restyled square-cut, and `PasswordInput` (Show / Hide).
- `public-chrome.tsx`: `PublicHeader` (wordmark, "Seller sign in") and `PublicFooter` (Help, Terms, the disclaimer) for the landing, help, terms, join, sign-in and error pages.
- `ticket.tsx`: paper ticket with notches, perforated stub and stub number.
- `ticket-button.tsx`: `TicketButton` (the screen's one primary: notched lamp-orange with a perforated stub) and `lineButton` (secondary cut-line class).
- `stamp.tsx`, `hang-tag.tsx`, `table-number.tsx`, `tape-hatch.tsx`, `section-mark.tsx`: under-market stamp, price tag, lamp-lit number block, "On hold"/"Sold out" tape, big-numeral section marker.
- `show-moment.tsx`: the celebration (stamp lands, stub punched) for store created, first item, and sale confirmed.
- `toast-root.tsx`: the Sileo `<Toaster />` (login and dashboard layouts only), paper toast CSS, reduced-motion `MotionConfig`, offline toasts, the polite and assertive announcement regions. Toast copy lives in `src/lib/toast.ts`.
- `stepper.tsx`, `continuous-tabs.tsx`, `labeled-progress-indicator.tsx`: adapted Watermelon UI components (MIT); each file header lists what changed from upstream.
- `card-thumb.tsx`, `segmented.tsx`, `wordmark.tsx`: small app pieces.

Primitive CSS lives in `src/styles/showfloor.css`; toast CSS in `src/styles/toasts.css`.
