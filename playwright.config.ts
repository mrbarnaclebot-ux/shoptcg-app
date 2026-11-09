import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const ci = Boolean(process.env.CI);
// Admins need no invite. Fresh per run (workers inherit the runner's env), one
// per test, so the 3-links-per-10-minutes limit never trips across reruns.
process.env.E2E_RUN ??= Date.now().toString(36);
export const admin = (n: number) =>
  `owner-${process.env.E2E_RUN}-${n}@example.test`;
// Sign-in links land here instead of being emailed (see src/lib/email.ts).
// Outside test-results, which Playwright empties while the server is running.
export const OUTBOX = join(tmpdir(), "shoptcg-magic-links.txt");
// E2E_PORT lets two checkouts run e2e side by side.
const port = Number(process.env.E2E_PORT ?? 3000);
const url = `http://localhost:${port}`;

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  use: { baseURL: url, trace: "on-first-retry", timezoneId: "UTC" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // CI builds in an earlier step, so it serves the production build.
    command: `${ci ? "pnpm start" : "pnpm dev"} -p ${port}`,
    url,
    // A server started without the outbox would email real links, so never reuse one.
    reuseExistingServer: false,
    timeout: 120_000,
    // PPT_API_KEY empty: e2e searches use TCGdex and spend no paid credits.
    env: {
      MAGIC_LINK_OUTBOX: OUTBOX,
      PPT_API_KEY: "",
      E2E_SEED: "1",
      BETTER_AUTH_URL: url,
      // Signs in without an invite; e2e/invites.spec.ts uses it for /admin.
      ADMIN_EMAILS: [0, 1, 2, 3].map(admin).join(","),
    },
  },
});
