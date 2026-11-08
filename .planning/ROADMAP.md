# Roadmap

Source of truth for scope: `PROJECT.md`. One branch and one PR per phase.

| # | Phase | Status | Branch |
| - | ----- | ------ | ------ |
| 1 | Foundation: scaffold, vendor auth, create store, T&C, design tokens, CI | built, reviewed, awaiting PR | phase-1-foundation |
| 2 | Catalog + nightly price sync | research spike in progress | - |
| 3 | Inventory: search-add, custom items, CSV import, pricing rule, FX | built, awaiting review (shots in phases/03-inventory/shots) | phase-3-inventory |
| 4 | Public store page + QR sign | planned | - |
| 5 | Interest flow + seller ping (holds, SSE, push) | planned | - |
| 6 | Confirm sale + receipts | planned | - |
| 7 | Reports + customers | planned | - |

## Open items
- Railway CLI login expired on dev machine: owner runs `railway login` before first deploy.
- Domain shoptcg.app ownership unconfirmed: use Resend test sender until DNS is set.
- PokemonPriceTracker API key: owner adds to `.env` (never committed).
- Price API licence: build on Free/Pro (dev allowed). Decide Business ($99/mo) vs alternative BEFORE the first real show. See research/PRICING-API.md.
- Polish pass before v1 ship: original abstract holo card art (no Pokemon IP) for landing preview + holo shimmer; tighten desktop hero vertical rhythm.
- instrumentation.ts logs invalid env but does not exit; Railway healthcheck on `/` can still pass. Revisit with a `/api/health` that checks DB when deploying.
