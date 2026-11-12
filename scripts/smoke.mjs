// Read-only checks on a deployed environment: `pnpm smoke https://host`.
// Never signs in or writes, because the e2e outbox is refused on Railway by design.
const base = process.argv[2]?.replace(/\/$/, "");
if (!base) throw new Error("usage: pnpm smoke <url>");

const missing = `smoke-${Date.now().toString(36)}`;
const checks = [
  [
    "/api/health",
    200,
    (t) => {
      const body = JSON.parse(t);
      return body.ok === true && body.live === true;
    },
  ],
  [`/${missing}`, 404],
  ["/login", 200],
  // The security headers from next.config.ts reach the browser through Railway.
  [
    "/",
    200,
    (_, res) => res.headers.get("x-content-type-options") === "nosniff",
  ],
  ["/robots.txt", 200, (t) => t.includes(`Sitemap: ${base}/sitemap.xml`)],
];

let failed = false;
for (const [path, status, body] of checks) {
  const res = await fetch(base + path, { redirect: "manual" });
  const text = await res.text();
  const ok = res.status === status && (!body || body(text, res));
  failed ||= !ok;
  console.log(`${ok ? "ok  " : "FAIL"} ${path} -> ${res.status}`);
}
if (failed) process.exit(1);
