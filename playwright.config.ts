import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const ci = Boolean(process.env.CI);
// Sign-in links land here instead of being emailed (see src/lib/email.ts).
// Outside test-results, which Playwright empties while the server is running.
export const OUTBOX = join(tmpdir(), "shoptcg-magic-links.txt");

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  use: { baseURL: "http://localhost:3000", trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // CI builds in an earlier step, so it serves the production build.
    command: ci ? "pnpm start" : "pnpm dev",
    url: "http://localhost:3000",
    // A server started without the outbox would email real links, so never reuse one.
    reuseExistingServer: false,
    timeout: 120_000,
    // PPT_API_KEY empty: e2e searches use TCGdex and spend no paid credits.
    env: { MAGIC_LINK_OUTBOX: OUTBOX, PPT_API_KEY: "" },
  },
});
