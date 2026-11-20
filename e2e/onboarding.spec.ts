import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { newBuyer, openVendor } from "./buyer";
import { addPushRow, hasDb } from "./db";

test("getting-started tips tick off from the store, hide once, and help stays", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
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

  // A buyer on the page means the sign or link is out; a stored push
  // subscription means locked-phone alerts are on.
  const buyer = await newBuyer(browser, slug);
  await expect(buyer.getByRole("region", { name: "Stock" })).toBeVisible();
  await expect(async () => {
    await page.reload();
    await expect(
      tips.getByRole("link", { name: "Print your table sign (done)" }),
    ).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await buyer.context().close();
  if (hasDb) {
    await addPushRow(
      `e2e-${slug.replace(/^e2e-/, "")}@example.test`,
      `https://fcm.googleapis.com/${randomUUID()}`,
    );
    await page.reload();
    await expect(
      tips.getByRole("link", { name: "Turn on alerts (done)" }),
    ).toBeVisible();
  }

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
