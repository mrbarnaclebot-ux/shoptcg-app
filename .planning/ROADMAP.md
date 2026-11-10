# Roadmap

Source of truth for scope: `PROJECT.md`. Current state, how to ship and what's next: `HANDOFF.md`. One branch and one PR per phase.

| #   | Phase                                                                  | Status      | PR  |
| --- | ---------------------------------------------------------------------- | ----------- | --- |
| 1   | Foundation: scaffold, vendor auth, create store, T&C, design tokens, CI | shipped     | #1  |
| 2   | Catalog + nightly price sync                                           | shipped     | #2  |
| 3   | Inventory: search-add, custom items, CSV import, pricing rule, FX      | shipped     | #3  |
| -   | Personality pass, then the Show floor visual direction                 | shipped     | #4, #5 |
| 4   | Public store page + QR sign                                            | shipped     | #6  |
| 5   | Interest flow + seller ping (holds, SSE, push)                         | shipped     | #7  |
| 6   | Confirm sale + receipts                                                | shipped     | #8  |
| 7   | Reports + customers                                                    | shipped     | #9  |
| -   | CI pipeline: secret scan, migration guards, staging then production    | shipped     | #10 |
| -   | Known-gap fixes: erasure, push, buyer list, report reads               | shipped     | #11 |
| -   | Vendor invites: sign-up by code, `/admin`                              | shipped     | #12 |
| -   | Store states: open, paused with auto-resume, not vending               | shipped     | #13 |
| 8   | Run-a-show journey at three viewports, deploy guards, price-sync cron  | shipped     | #16 |

## Open items

- Price API licence: the owner chose to run on the PPT Pro plan ($9.99/mo, 20k credits a day) on 2026-11-10. PPT's terms reserve Pro for hobby and pre-launch use and ask for Business ($99/mo) once vendors sell commercially. Revisit before the first public show. See `research/PRICING-API.md`.
- Domain: none yet, so `EMAIL_FROM` stays on the Resend test sender and mail only reaches the Resend account owner. Buyer receipts will show "Email didn't send" until a domain is verified.
- Not checked on real hardware: push and the chime on a phone, the printed sign scanned from 1 m, both CSV exports in Excel and Sheets.
