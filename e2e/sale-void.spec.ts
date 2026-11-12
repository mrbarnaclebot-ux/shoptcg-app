import { expect, test } from "@playwright/test";
import { confirm, openVendor, pay, reviewSale } from "./buyer";

test("a vendor voids a sale, puts the stock back and it leaves the totals", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  const buyer = await reviewSale(page, browser, slug, ["Charizard ex"]);
  await pay(page, "Cash");
  await confirm(page).click();
  await expect(page.getByTestId("receipt-no")).toHaveText("R-0001");

  // Keep backs out; the restock box starts ticked.
  await page.getByRole("button", { name: "Void sale" }).click();
  await page.getByRole("button", { name: "Keep sale" }).click();
  await page.getByRole("button", { name: "Void sale" }).click();
  await expect(page.getByLabel("Put the items back in stock")).toBeChecked();
  await page.getByLabel("Reason (optional)").fill("Rang up the wrong card");
  await page.getByRole("button", { name: "Void sale" }).click();
  await expect(page.getByText("Voided", { exact: true })).toBeVisible();
  await expect(page.getByText(/The items went back in stock\./)).toBeVisible();
  await expect(page.getByText("Rang up the wrong card")).toBeVisible();
  await expect(page.getByRole("button", { name: "Void sale" })).toHaveCount(0);

  await page.goto("/dashboard/inventory");
  await expect(
    page
      .getByRole("group", { name: "Quantity, Charizard ex" })
      .getByRole("status"),
  ).toHaveText("3");

  await page.goto("/dashboard/sales");
  await expect(page.getByText("0 sales, $0.00")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /R-0001/ }).getByText("Voided"),
  ).toBeVisible();

  await page.goto("/dashboard/reports");
  await expect(page.getByText("No sales in this range.")).toBeVisible();

  // The buyer's receipt says so too.
  await buyer.reload();
  await expect(
    buyer.getByRole("heading", { name: "This sale was voided." }),
  ).toBeVisible();
});
