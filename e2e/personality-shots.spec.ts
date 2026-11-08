import { expect, test, type Page } from "@playwright/test";
import { newVendor } from "./auth";

// Personality-pass screenshots, not a regression test:
//   SHOTS=personality pnpm e2e personality-shots
// Toasts are caught mid-animation, so each width replays its own flow.
const OUT = ".planning/phases/personality/shots";
const MID_ANIMATION_MS = 420;

test.skip(process.env.SHOTS !== "personality", "set SHOTS=personality");
test.setTimeout(240_000);

async function shot(page: Page, name: string, width: number, wait = 0) {
  await page.addStyleTag({ content: "nextjs-portal { display: none }" });
  if (wait) await page.waitForTimeout(wait);
  await page.screenshot({ path: `${OUT}/${name}-${width}.png` });
}

for (const width of [390, 1280]) {
  test(`personality at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 800 });

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await shot(page, "landing", width);

    // newVendor signs in (toast on send) and creates the store (celebration).
    await page.goto("/login");
    await page
      .getByLabel("Email")
      .fill(`shots-${width}-${Date.now()}@example.test`);
    await page.getByRole("button", { name: "Email me a link" }).click();
    await expect(page.getByText("Link sent.", { exact: true })).toBeVisible();
    await shot(page, "login-sent", width, MID_ANIMATION_MS);

    await newVendor(page);
    await expect(
      page.getByRole("heading", { name: "You're open" }),
    ).toBeVisible();
    await shot(page, "store-created", width, MID_ANIMATION_MS);

    await page.goto("/dashboard/settings");
    await page.getByLabel("Price rule (% of market)").fill("-10");
    await page.getByText("Nearest $0.50").click();
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Saved.", { exact: true })).toBeVisible();
    await shot(page, "settings-saved", width, MID_ANIMATION_MS);

    await page.goto("/dashboard/inventory/import");
    await page
      .locator("input[type=file]")
      .setInputFiles("public/inventory-template.csv");
    const importBtn = page.getByRole("button", { name: /^Import \d+ items$/ });
    await expect(importBtn).toBeVisible({ timeout: 120_000 });
    await importBtn.click();
    await expect(page).toHaveURL(/\/dashboard\/inventory$/);
    await expect(page.getByText(/\d+ logged/).first()).toBeVisible();
    await shot(page, "csv-import", width, 700);

    const row = page.getByRole("listitem").first();
    while ((await row.locator("output").textContent()) !== "0")
      await row.getByRole("button", { name: "One fewer" }).click();
    await expect(page.getByText("Qty 0", { exact: true })).toBeVisible();
    await shot(page, "inventory-toast", width, MID_ANIMATION_MS);
  });
}
