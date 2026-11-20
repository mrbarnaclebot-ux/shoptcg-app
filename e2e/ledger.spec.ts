import { expect, test, type Page } from "@playwright/test";
import { confirmAndView, openVendor, pay, reviewSale } from "./buyer";

const figure = (page: Page, label: string) =>
  page.locator("dl > div", { hasText: label }).locator("dd");

test("the ledger shows profit, stock value and every stock move", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  await page.goto("/dashboard/inventory");
  const row = page.getByRole("listitem").filter({ hasText: "Charizard ex" });
  await row.getByRole("button", { name: "Edit" }).click();
  await row.getByLabel("What you paid, each (USD)").fill("200");
  await row.getByRole("button", { name: "Save" }).click();
  await expect(row.getByRole("button", { name: "Edit" })).toBeVisible();

  // One item with a cost and one without, sold together.
  await reviewSale(page, browser, slug, ["Charizard ex", "Mew ex"]);
  await pay(page, "Cash");
  await confirmAndView(page);
  await expect(page.getByTestId("receipt-no")).toHaveText("R-0001");

  await page.goto("/dashboard/settings");
  await page.getByRole("link", { name: "Ledger" }).click();
  await expect(page.getByRole("heading", { name: "Ledger" })).toBeVisible();
  await expect(figure(page, "What those items cost you")).toHaveText("$200.00");
  // Charizard sold at $265.50 against a $200 cost; Mew has no cost and is left out.
  await expect(figure(page, "Profit")).toHaveText("$65.50");
  await expect(page.getByText(/1 item sold had no cost entered/)).toBeVisible();
  // Two Charizards are left, at $200 each.
  await expect(figure(page, "What it cost you")).toHaveText("$400.00");

  const sold = page
    .getByRole("listitem")
    .filter({ hasText: "Charizard ex" })
    .filter({ hasText: "Sold" });
  await expect(sold).toContainText("R-0001");
  await expect(sold).toContainText("2 left");
  await expect(sold).toContainText("−1");
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: "Charizard ex" })
      .filter({ hasText: "Added" }),
  ).toContainText("+3");

  // Yesterday has none of it.
  const day = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
  await page.goto(`/dashboard/ledger?from=${day}&to=${day}`);
  await expect(figure(page, "Profit")).toHaveText("$0.00");
  await expect(page.getByText("No stock changed in these days.")).toBeVisible();
});
