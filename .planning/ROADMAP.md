# Roadmap

Source of truth for scope: `PROJECT.md`. One branch and one PR per phase.

| # | Phase | Status | Branch |
| - | ----- | ------ | ------ |
| 1 | Foundation: scaffold, vendor auth, create store, T&C, design tokens, CI | in progress | phase-1-foundation |
| 2 | Catalog + nightly price sync | research spike in progress | - |
| 3 | Inventory: search-add, custom items, CSV import, pricing rule, FX | planned | - |
| 4 | Public store page + QR sign | planned | - |
| 5 | Interest flow + seller ping (holds, SSE, push) | planned | - |
| 6 | Confirm sale + receipts | planned | - |
| 7 | Reports + customers | planned | - |

## Open items
- Railway CLI login expired on dev machine: owner runs `railway login` before first deploy.
- Domain shoptcg.app ownership unconfirmed: use Resend test sender until DNS is set.
- PokemonPriceTracker API key: owner adds to `.env` (never committed).
