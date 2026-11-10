import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { newVendor, signIn } from "./auth";
import { saveSettings } from "./settings";

// Phase screenshots, not a regression test. Two stages so the nightly sync can
// run in between and the list shows market prices:
//   SHOTS=setup pnpm e2e shots; PPT_API_KEY= pnpm sync:prices; SHOTS=capture pnpm e2e shots
const STAGE = process.env.SHOTS;
const OUT = ".planning/phases/03-inventory/shots";
const ID_FILE = join(tmpdir(), "shoptcg-shots-id.txt");
const WIDTHS = [390, 1280];

test.skip(!STAGE, "set SHOTS=setup or SHOTS=capture");
test.setTimeout(180_000);

async function shoot(page: Page, name: string) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 800 });
    await page.waitForLoadState("networkidle");
    // The dev-mode Next badge is not part of the product.
    await page.addStyleTag({ content: "nextjs-portal { display: none }" });
    await page.screenshot({
      path: `${OUT}/${name}-${width}.png`,
      fullPage: true,
    });
  }
}

test("setup: settings, search, CSV preview", async ({ page }) => {
  test.skip(STAGE !== "setup");
  await page.setViewportSize({ width: 390, height: 844 });
  const id = await newVendor(page);
  await writeFile(ID_FILE, id);

  await saveSettings(page, {
    nfc: true,
    rule: "-10",
    rounding: "Nearest $0.50",
    currency: ["AUD", "1.52"],
  });
  await page.goto("/dashboard/settings/pricing");
  await shoot(page, "settings");

  await page.goto("/dashboard/inventory/add");
  await page.getByLabel("Search the catalog").fill("charizard");
  await expect(
    page.getByRole("button", { name: /Charizard/ }).first(),
  ).toBeVisible({ timeout: 30_000 });
  await shoot(page, "add-search");
  await page
    .getByRole("button", { name: /Charizard/ })
    .first()
    .click();
  await page.getByText("LP", { exact: true }).click();
  await shoot(page, "add-pick");
  await page.getByRole("button", { name: "Add to stock" }).click();
  await expect(page.getByText(/Added .* to your stock/)).toBeVisible();

  await page.goto("/dashboard/inventory/import");
  await page
    .locator("input[type=file]")
    .setInputFiles("public/inventory-template.csv");
  await expect(
    page.getByRole("button", { name: /^Import \d+ items$/ }),
  ).toBeVisible({ timeout: 90_000 });
  await shoot(page, "csv-preview");
  await page.getByRole("button", { name: /^Import \d+ items$/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/inventory$/);
});

test("capture: inventory list after the price sync", async ({ page }) => {
  test.skip(STAGE !== "capture");
  const id = (await readFile(ID_FILE, "utf8")).trim();
  await signIn(page, `e2e-${id}@example.test`);
  await page.goto("/dashboard/inventory");
  await expect(page.getByRole("listitem").first()).toBeVisible();
  await shoot(page, "inventory");
});
