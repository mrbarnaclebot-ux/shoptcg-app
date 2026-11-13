import { expect, test, type Page } from "@playwright/test";
import { newVendor } from "./auth";
import { setStore } from "./buyer";
import { saveSettings } from "./settings";

// Show floor screenshots, not a regression test:
//   SHOTS=showfloor pnpm e2e showfloor-shots
// (SHOTS_OUT=.planning/phases/show-floor/after for the post-critique set.)
// Toasts are caught mid-animation, so each width replays its own flow.
const OUT = process.env.SHOTS_OUT ?? ".planning/phases/show-floor/shots";
const MID_ANIMATION_MS = 380;

test.skip(process.env.SHOTS !== "showfloor", "set SHOTS=showfloor");
test.setTimeout(240_000);

// Photo screens go to JPEG so each file stays under 400 KB.
const PHOTO = new Set(["landing", "login-sent", "landing-zoom"]);

async function shot(page: Page, name: string, width: number, wait = 0) {
  await page.addStyleTag({ content: "nextjs-portal { display: none }" });
  if (wait) await page.waitForTimeout(wait);
  const ext = PHOTO.has(name) ? "jpg" : "png";
  await page.screenshot({
    path: `${OUT}/${name}-${width}.${ext}`,
    ...(ext === "jpg" && { quality: 82 }),
  });
}

for (const width of [390, 1280]) {
  test(`show floor at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 800 });

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await shot(page, "landing", width, 600);

    await page.goto("/login");
    await page
      .getByLabel("Email")
      .fill(`shots-${width}-${Date.now()}@example.test`);
    await page.getByRole("button", { name: "Email me a link" }).click();
    await expect(
      page.getByText("Check your email.", { exact: true }),
    ).toBeVisible();
    await shot(page, "login-sent", width, MID_ANIMATION_MS);

    await newVendor(page);
    await expect(
      page.getByRole("heading", { name: "Your store is set" }),
    ).toBeVisible();
    await shot(page, "store-created", width, 500);
    await setStore(page, "open");
    await expect(
      page.locator(".toasts").getByText("Buyers can send requests now."),
    ).toBeVisible();
    await shot(page, "open-toast", width, MID_ANIMATION_MS);

    await saveSettings(page, { rule: "-10", rounding: "Nearest $0.50" });
    await shot(page, "settings", width, MID_ANIMATION_MS);

    await page.goto("/dashboard/inventory/import");
    await page
      .locator("input[type=file]")
      .setInputFiles("public/inventory-template.csv");
    const importBtn = page.getByRole("button", { name: /^Import \d+ items$/ });
    await expect(importBtn).toBeVisible({ timeout: 120_000 });
    await shot(page, "csv-import", width);
    await importBtn.click();
    await expect(page).toHaveURL(/\/dashboard\/inventory$/);

    const row = page.getByRole("listitem").first();
    while ((await row.locator("output").textContent()) !== "0")
      await row.getByRole("button", { name: "One fewer" }).click();
    await expect(
      page.getByText("Sold out", { exact: true }).first(),
    ).toBeVisible();
    await shot(page, "inventory-toast", width, MID_ANIMATION_MS);

    await page.context().setOffline(true);
    await row.getByRole("button", { name: "One more" }).click();
    await expect(page.getByText("Not saved.", { exact: true })).toHaveCount(2);
    await shot(page, "error-toast", width, MID_ANIMATION_MS);
    await page.context().setOffline(false);
    await expect(
      page.locator(".toasts").getByText("Back online."),
    ).toBeVisible();
    await shot(page, "online-toast", width);

    await page.goto("/dashboard/inventory/add");
    await shot(page, "add", width);
  });
}

// Text zoom check: the poster headline at the narrowest phone, and the desktop
// hero at 200% (a 1920 window is 960 CSS px wide) with nothing clipped.
test("landing headline at 320 and desktop 200% zoom", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");
  await shot(page, "landing", 320, 600);
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto("/");
  await shot(page, "landing-zoom", 960, 600);
});
