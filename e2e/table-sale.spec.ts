import { expect, test } from "@playwright/test";
import { confirmAndView, openVendor, pay } from "./buyer";

test("a vendor sells to a buyer at the table without an email", async ({
  page,
}) => {
  await openVendor(page);
  await page.goto("/dashboard/inventory");
  const bar = page.getByRole("link", { name: /^Table sale/ });
  await page.getByRole("button", { name: "Sell Charizard ex" }).click();
  await expect(bar).toContainText("1 item,");
  await page.getByRole("button", { name: "Sell Mew ex" }).click();
  await expect(bar).toContainText("2 items");

  await bar.click();
  await expect(
    page.getByRole("heading", { name: "Sale for Walk-up" }),
  ).toBeVisible();
  await pay(page, "Cash");
  await confirmAndView(page);
  await expect(page.getByTestId("receipt-no")).toHaveText("R-0001");
  await expect(
    page.getByText("Sold at the table. No receipt was emailed."),
  ).toBeVisible();

  // Stock dropped and the bar is gone.
  await page.goto("/dashboard/inventory");
  await expect(bar).toHaveCount(0);
  await expect(
    page
      .getByRole("group", { name: "Quantity, Charizard ex" })
      .getByRole("status"),
  ).toHaveText("2");
});
