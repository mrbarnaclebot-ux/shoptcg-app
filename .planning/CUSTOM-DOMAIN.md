# Switching to the custom domain (tcgmart.app)

Production moves to the apex `tcgmart.app` and staging to `staging.tcgmart.app`. The Railway hosts keep working: QR signs already printed point at `web-production-2d3b0.up.railway.app`, and once `CANONICAL_HOST` is set, `src/proxy.ts` sends every GET and HEAD on another host to the same path and query on the new one (308). `/api/health` is exempt, because Railway's healthcheck uses the container's own host, and so are POSTs (a ping from a page still open on the old host would lose its body).

**The app's own URL comes from one variable, `BETTER_AUTH_URL`.** Through `appUrl()` it builds:
- sign-in links and invite links
- QR and sign URLs
- receipt and unsubscribe links
- the origin checks in `/api/visit` and `/api/store-image`
- `robots.txt` and `sitemap.xml`

better-auth reads it for its base URL and trusted origin. Cookies are host-only, with no domain set anywhere. Image hosts (`next.config.ts`) and the CSP don't name the app's host. `pnpm smoke` takes the URL as an argument. Nothing hard-codes a Railway domain.

**Never remove the Railway domains from the services.** Printed signs depend on them.

## 1. Production domain on Railway (`web`, production environment)

1. Railway: open the `web` service, then Settings, Networking, Custom Domain. Add `tcgmart.app`, with port 8080 or whatever the service listens on (the same target port as the Railway domain).
2. At the registrar or DNS host, add exactly the records Railway shows. That is usually:
   - a CNAME for the domain, pointing at the `*.up.railway.app` target it gives
   - a TXT record if it asks for verification

   An apex can't be a plain CNAME. Use your DNS host's ALIAS, ANAME or CNAME flattening. Cloudflare does this automatically; there, set the record to "DNS only" (grey cloud) so Railway can issue the certificate.
3. Optional: add `www.tcgmart.app` the same way. The redirect below sends it to the apex.
4. Wait until Railway shows the domain verified with a certificate. Then check that `curl -sI https://tcgmart.app/api/health` returns 200. No variables have changed yet, so the app still thinks it lives on the Railway host. That's fine for health.

## 2. Mail: Resend domain

1. In Resend, go to Domains and add `tcgmart.app`. Resend lists the DNS records:
   - an MX and an SPF TXT on its `send` subdomain
   - a DKIM TXT at `resend._domainkey`

   Add each one exactly as shown.
2. Add a DMARC record: TXT `_dmarc.tcgmart.app` with value `v=DMARC1; p=none; rua=mailto:<your address>`. Tighten it to `quarantine` later.
3. Click Verify in Resend and wait until every record is green.
4. On `web` and `web-staging`, set `EMAIL_FROM` to `tcgmart <receipts@tcgmart.app>` (any local part works once the domain is verified). The boot check (`src/lib/env-check.ts`) and `/admin` System warn while it is unset or still `@resend.dev`.

## 3. Switch production variables (`web`, production)

Set these two in **one** change, so Railway does one redeploy:

| Variable          | New value              |
| ----------------- | ---------------------- |
| `BETTER_AUTH_URL` | `https://tcgmart.app`  |
| `CANONICAL_HOST`  | `tcgmart.app`          |

The boot check refuses a `CANONICAL_HOST` that isn't `BETTER_AUTH_URL`'s host: a redirect away from the host that sign-in links use would loop. Nothing else changes: `BETTER_AUTH_SECRET`, `DATABASE_URL`, Pinata, VAPID and PPT stay as they are. `price-sync` makes no URLs and needs nothing.

## 4. Staging (`web-staging`, staging environment)

Do the same with `staging.tcgmart.app`:
1. Add the custom domain on Railway, with a CNAME for `staging` at the DNS host.
2. Set `BETTER_AUTH_URL=https://staging.tcgmart.app` and `CANONICAL_HOST=staging.tcgmart.app`.
3. Set `EMAIL_FROM`. The same verified domain works, e.g. `tcgmart staging <staging@tcgmart.app>`.

Doing staging first is a good rehearsal.

## 5. Smoke (read-only)

1. Run `pnpm smoke https://tcgmart.app`. It checks:
   - health and live
   - a real 404
   - login
   - the security headers
   - that `robots.txt` names `https://tcgmart.app/sitemap.xml`
2. Run `curl -sI https://web-production-2d3b0.up.railway.app/some-store?src=sign`. It should return `308` with `location: https://tcgmart.app/some-store?src=sign`.
3. Run `curl -s https://web-production-2d3b0.up.railway.app/api/health`. It should return 200, not a redirect.
4. Scan a printed sign. It should land on `https://tcgmart.app/<slug>`.
5. Sign in on `https://tcgmart.app/login` as the owner. The link in the email should be on `tcgmart.app`.
6. Send yourself a test receipt from preview. It should come from `receipts@tcgmart.app`, the links should be on `tcgmart.app`, and it should not land in spam.
7. Repeat 1 to 3 for staging and `pnpm smoke https://staging.tcgmart.app`.

## What users notice

- **Vendors sign in again.** Session cookies belong to the old host. The redirect takes them to the new login.
- **Push alerts:** re-enable them under More, Alerts on the new domain. A service worker and its push subscription belong to one origin. The old subscription still delivers, but its clicks open the old host and get redirected. A phone that added the app to its home screen should add it again from `tcgmart.app`.
- **Buyers lose any unsent list and their visitor id.** `localStorage` is per origin. This only matters mid-show, so switch between shows.
- **Old emails still work:**
  - sign-in links (GET, redirected; the token is in the database)
  - receipt links and unsubscribe pages
  - one-click unsubscribe (a POST to the old host, handled there, no redirect)
- **Printed signs work forever,** as long as the Railway domain stays attached. Reprint at leisure. New signs use `tcgmart.app`.

## Rolling back

Unset `CANONICAL_HOST` and set `BETTER_AUTH_URL` back to the Railway URL. The redirect stops at once. Vendors sign in again on the old host.

## After the switch

- Update `.planning/HANDOFF.md`: "Live" URLs, and remove owner to-do 1.
- The brand rename (UI copy, titles, `shoptcg:*` storage keys, CSV file names) is a separate PR. Storage keys are per origin, so renaming them in the same release as the switch costs nothing extra.
