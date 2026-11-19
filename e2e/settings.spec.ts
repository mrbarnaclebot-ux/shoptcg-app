import { expect, test } from "@playwright/test";
import { admin } from "../playwright.config";
import { newVendor, signIn } from "./auth";
import { openVendor } from "./buyer";
import { hasDb } from "./db";
import { saveSettings } from "./settings";

test("each settings page saves on its own, and the store can be renamed", async ({
  page,
}) => {
  await newVendor(page);
  await saveSettings(page, { table: "B14", nfc: true });
  // Saving pricing must not wipe what the table page saved.
  await saveSettings(page, { rule: "5", currency: ["AUD", "1.52"] });
  await page.goto("/dashboard/settings/table");
  await expect(page.getByLabel("Table number")).toHaveValue("B14");
  await expect(page.getByLabel("I have an NFC tag on my table")).toBeChecked();

  await page.getByRole("link", { name: "Store profile" }).click();
  const nameTile = page.getByRole("region", { name: "Name" });
  await page.getByLabel("Store name").fill("Renamed Cards");
  await nameTile.getByRole("button", { name: "Save", exact: true }).click();
  await expect(nameTile.getByText("Saved.", { exact: true })).toBeVisible();
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { level: 1, name: "Renamed Cards" }),
  ).toBeVisible();

  await page.goto("/dashboard/settings/store");
  await page.getByLabel("Store name").fill(" ");
  await nameTile.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.locator("main").getByText("Enter a store name"),
  ).toBeVisible();
});

test("a new store link takes over, and the old one still lands", async ({
  page,
}) => {
  const id = await newVendor(page);
  await page.goto("/dashboard/settings/store");
  const linkTile = page.getByRole("region", { name: "Link" });
  await page.getByLabel("Store link").fill(`moved-${id}`);
  await linkTile.getByRole("button", { name: "Save", exact: true }).click();
  await expect(linkTile.getByText("Saved.", { exact: true })).toBeVisible();

  await page.goto(`/e2e-${id}/cart?from=sign`);
  await expect(page).toHaveURL(new RegExp(`/moved-${id}/cart\\?from=sign$`));

  // A reserved word is refused before it reaches the server.
  await page.goto("/dashboard/settings/store");
  await page.getByLabel("Store link").fill("login");
  await expect(linkTile.getByText("That address is reserved")).toBeVisible();
});

test("on a phone, More is a menu and its pages lead back to it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await newVendor(page);
  await page.goto("/dashboard/settings");
  const menu = page.getByRole("navigation", { name: "Settings" });
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await menu.getByRole("link", { name: "How you sell" }).click();
  await expect(page.getByLabel("Table number")).toBeVisible();
  await expect(menu.getByRole("link", { name: "Pricing" })).toBeHidden();
  await expect(
    page.getByRole("link", { name: "Print table sign" }),
  ).toBeVisible();
  await menu.getByRole("link", { name: "More" }).click();
  await expect(page).toHaveURL(/\/dashboard\/settings$/);
  await expect(menu.getByRole("link", { name: "Pricing" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Admin" })).toHaveCount(0);
});

test("an admin with no store reaches Admin, stops a store and allows it again", async ({
  page,
  browser,
}) => {
  test.skip(!hasDb, "needs DATABASE_URL");
  const vendor = await browser.newPage();
  const slug = await openVendor(vendor);
  const buyer = await browser.newPage();
  const closed = buyer.getByText(/isn.t vending right now/);
  await buyer.goto(`/${slug}`);
  await expect(closed).toHaveCount(0);

  await signIn(page, admin(4));
  await page.goto("/dashboard/settings");
  await page
    .getByRole("navigation", { name: "Settings" })
    .getByRole("link", { name: "Admin" })
    .click();
  const row = page.getByRole("listitem").filter({ hasText: `/${slug}.` });
  await expect(row).toContainText("Open.");
  await row.getByRole("button", { name: "Stop store" }).click();
  await row.getByRole("button", { name: "Stop store" }).click();
  await expect(row).toContainText("Stopped by admin");

  await buyer.reload();
  await expect(closed).toBeVisible();
  await vendor.reload();
  await expect(
    vendor.getByRole("heading", { name: "Stopped by an admin" }),
  ).toBeVisible();
  await expect(vendor.getByRole("button", { name: "Open store" })).toHaveCount(
    0,
  );

  await row.getByRole("button", { name: "Allow store" }).click();
  await expect(row).toContainText("Open.");
  await buyer.reload();
  await expect(closed).toHaveCount(0);
});
