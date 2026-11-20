import { expect, test, type Page } from "@playwright/test";
import { exported, openVendor } from "./buyer";

const row = (page: Page, name: string) =>
  page
    .getByRole("list", { name: "Your stock" })
    .getByRole("listitem")
    .filter({ hasText: name });

test("a lower count says why, and the ledger and its CSV show it", async ({
  page,
}) => {
  await openVendor(page);
  await page.goto("/dashboard/inventory");
  await row(page, "Gengar").getByRole("button", { name: "Edit" }).click();
  const panel = row(page, "Gengar");
  await expect(panel.getByLabel("Why fewer?")).toHaveCount(0);
  await panel.getByRole("spinbutton", { name: "Quantity" }).fill("1");
  await panel.getByLabel("Why fewer?").selectOption("Damaged");
  await panel.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".toasts")).toContainText("Quantity 1.");

  await page.goto("/dashboard/ledger");
  const move = page
    .getByRole("listitem")
    .filter({ hasText: "Gengar" })
    .filter({ hasText: "Damaged" });
  // Which Gengar: set, number and condition.
  await expect(move).toContainText("Lost Origin 066 NM");
  const csv = await exported(page, "Export ledger");
  expect(csv.file).toMatch(/-ledger-\d{4}-\d\d-\d\d\.csv$/);
  expect(csv.head.slice(0, 4)).toEqual(["date", "time", "entry", "item"]);
  const damaged = csv.rows.find((r) => r[2] === "Damaged");
  expect(damaged?.slice(3, 9)).toEqual([
    "Gengar",
    "Lost Origin",
    "066",
    "NM",
    "-1",
    "1",
  ]);
});

test("ticked rows take one fixed price, then follow the market again", async ({
  page,
}) => {
  await openVendor(page);
  await page.goto("/dashboard/inventory");
  await page.getByLabel("Select Gengar").check();
  await page.getByLabel("Select Surging Sparks booster box").check();
  const bar = page.getByRole("region", { name: "Selected items" });
  await bar.getByRole("button", { name: "Set price" }).click();
  await bar.getByLabel("Fixed price each (USD)").fill("4.50");
  await bar.getByRole("button", { name: "Set fixed price" }).click();
  await expect(page.locator(".toasts")).toContainText(
    "2 items. Fixed price 4.50.",
  );
  await expect(row(page, "Gengar")).toContainText("$4.50");
  await expect(row(page, "Surging Sparks booster box")).toContainText("$4.50");

  await page.getByLabel("Select Gengar").check();
  await bar.getByRole("button", { name: "Set price" }).click();
  await bar.getByRole("button", { name: "Follow market" }).click();
  await expect(page.locator(".toasts")).toContainText(
    "Gengar. Follows the market.",
  );
  await expect(row(page, "Gengar")).not.toContainText("$4.50");
});
