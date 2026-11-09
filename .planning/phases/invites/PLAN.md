# Vendor invites

Owner approved 2026-11-09. Buyers never need an account; only invited people can become vendors.

- `/login`: existing accounts and `ADMIN_EMAILS` only. Anyone else gets the same "Check your email" screen, no email and no account. Links send in `after()`, so response time doesn't reveal who is a vendor. A failed send is only logged, so a vendor whose email fails sees "check your email" with nothing arriving.
- `/join`, `/join/CODE`: code plus email. A code is 80 random bits in four groups of Crockford base32, stored as sha256 and shown once. Single use, 14 days, revocable. Submitting reserves the invite for that email; re-entering replaces the reservation until it's used, so a typo is recoverable. An email with an account gets a normal sign-in link and the code stays unused. Rate limited per IP (`join:ip`) and per email.
- Enforced in `databaseHooks.user.create.before`: admin emails pass; everyone else must atomically claim an active invite reserved for their email, or no user is created and the link lands on `/login` with a clear message. `/sign-in/magic-link` is in `disabledPaths`, so sends only go through our limits.
- `/admin`: `requireAdmin` in every page and action. Create, revoke, invite status, and all accounts for review.

Ceilings: if the user insert fails after the claim, the invite is spent and the admin mints another. Railway's edge logs may record the `/join/CODE` path; the code is single use, expires, and the app never logs it. The code is a bearer token: until the invitee clicks their link, anyone who sees the code can re-reserve it for another email (the price of typo recovery). The admin page then shows who used it. One code triggers at most 5 sign-in emails a day.
