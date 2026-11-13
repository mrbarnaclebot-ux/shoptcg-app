import { expect, test } from "@playwright/test";
import { openVendor } from "./buyer";

test("getting-started tips tick off from the store, hide once, and help stays", async ({
  page,
}) => {
  await openVendor(page);
  const tips = page.getByRole("region", { name: "Getting started" });
  await expect(tips).toBeVisible();
  // The seed adds stock and the helper opened the store.
  await expect(
    tips.getByRole("link", { name: /Add your stock \(done\)/ }),
  ).toBeVisible();
  await expect(tips.getByText(/Open your store \(done\)/)).toBeVisible();
  await expect(
    tips.getByRole("link", { name: "Print your table sign" }),
  ).toHaveAttribute("href", "/dashboard/sign");

  await tips.getByRole("button", { name: "Hide tips" }).click();
  await expect(tips).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("region", { name: "Your store" })).toBeVisible();
  await expect(tips).toHaveCount(0);

  await page.goto("/dashboard/settings");
  await page.getByRole("link", { name: /^Help/ }).click();
  await expect(page).toHaveURL(/\/help$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Help" }),
  ).toBeVisible();
});
