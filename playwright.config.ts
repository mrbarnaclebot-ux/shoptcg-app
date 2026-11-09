import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const ci = Boolean(process.env.CI);
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
  use: { baseURL: url, trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // CI builds in an earlier step, so it serves the production build.
    command: `${ci ? "pnpm start" : "pnpm dev"} -p ${port}`,
    url,
    // A server started without the outbox would email real links, so never reuse one.
    reuseExistingServer: false,
    timeout: 120_000,
    // PPT_API_KEY empty: e2e searches use TCGdex and spend no paid credits.
    env: { MAGIC_LINK_OUTBOX: OUTBOX, PPT_API_KEY: "", BETTER_AUTH_URL: url },
  },
});
