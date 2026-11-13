import { expect, test } from "@playwright/test";
import { newVendor } from "./auth";
import { setStore } from "./buyer";
import { saveSettings } from "./settings";

test("a vendor adds a custom item and sees it in inventory", async ({
  page,
}) => {
  await newVendor(page);
  await page.getByRole("link", { name: "Inventory" }).first().click();
  await expect(page.getByText("Your shelf is empty.")).toBeVisible();

  await page.getByRole("link", { name: "Add a card" }).click();
  await page
    .getByRole("button", { name: "Not in the catalog? Add a custom item" })
    .click();
  await page.getByText("Chinese", { exact: true }).click();
  await page.getByLabel("Name").fill("Pikachu Gold Star CN promo");
  await page.getByLabel("Number").fill("SM-P 1");
  await page.getByLabel("Qty").fill("2");
  await page.getByLabel("Fixed price (optional)").fill("25");
  await page.getByLabel("What you paid, each (USD)").fill("$12.5");
  await page.getByRole("button", { name: "Add custom item" }).click();
  await expect(
    page.getByText("Added Pikachu Gold Star CN promo"),
  ).toBeVisible();

  await page.goto("/dashboard/inventory");
  const row = page
    .getByRole("listitem")
    .filter({ hasText: "Pikachu Gold Star" });
  await expect(row).toContainText("$25.00");
  await expect(row).toContainText("CN");
  await expect(row.locator("output")).toHaveText("2");
  // The cost from the add form is the one the edit panel holds.
  await row.getByRole("button", { name: "Edit" }).click();
  await expect(row.getByLabel("What you paid, each (USD)")).toHaveValue(
    "12.50",
  );
  await row.getByRole("button", { name: "Close" }).click();

  // The digit changes straight away; a reload before the save lands would abort it.
  const saved = page.waitForResponse((r) => r.request().method() === "POST");
  await row.getByRole("button", { name: "One more" }).click();
  await expect(row.locator("output")).toHaveText("3");
  await saved;
  await page.reload();
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: "Pikachu Gold Star" })
      .locator("output"),
  ).toHaveText("3");
});

test("store settings keep their choices after saving", async ({ page }) => {
  await newVendor(page);
  await saveSettings(page, { rule: "-10", rounding: "Nearest $0.50" });
  await expect(
    page.getByRole("radio", { name: "Nearest $0.50" }),
  ).toBeChecked();
  await page.reload();
  await expect(
    page.getByRole("radio", { name: "Nearest $0.50" }),
  ).toBeChecked();
  await expect(page.getByLabel("Price rule (% of market)")).toHaveValue("-10");
});

test("a new store starts paused and one tap opens it", async ({ page }) => {
  await newVendor(page);
  await expect(
    page.getByRole("heading", { name: "Your store is set" }),
  ).toBeVisible();
  const control = page.getByRole("region", { name: "Your store" });
  await expect(control).toHaveAttribute("data-state", "paused");
  await setStore(page, "open");
  await expect(
    page.locator(".toasts").getByText("Buyers can send requests now."),
  ).toBeVisible();
  await page.reload();
  await expect(control).toHaveAttribute("data-state", "open");
});

test("the sold out toast moves off the row just tapped", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 500 });
  await newVendor(page);
  await page.goto("/dashboard/inventory/add");
  await page
    .getByRole("button", { name: "Not in the catalog? Add a custom item" })
    .click();
  await page.getByLabel("Name").fill("Flip test card");
  await page.getByLabel("Qty").fill("1");
  await page.getByLabel("Fixed price (optional)").fill("5");
  await page.getByRole("button", { name: "Add custom item" }).click();
  await expect(page.getByText("Added Flip test card")).toBeVisible();
  await page.goto("/dashboard/inventory");

  const row = page.locator("main li").filter({ hasText: "Flip test card" });
  // Park the row right under the header, where phone toasts land.
  await row.evaluate((el) => {
    document.body.style.paddingBottom = "2000px";
    scrollBy(0, el.getBoundingClientRect().top - 70);
  });
  await row.getByRole("button", { name: "One fewer" }).click();
  const toast = page.locator(".toasts li").filter({ hasText: "Sold out" });
  await expect(toast).toBeVisible();
  await expect(page.locator(".toasts")).toHaveAttribute("data-flip");
  const [a, b] = [await toast.boundingBox(), await row.boundingBox()];
  expect(a!.y >= b!.y + b!.height || b!.y >= a!.y + a!.height).toBe(true);
});
