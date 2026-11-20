import { expect, test, type Locator, type Page } from "@playwright/test";
import { confirmAndView, openVendor, pay, reviewSale, setStore } from "./buyer";

const figure = (in_: Page | Locator, label: string) =>
  in_.locator("dl > div", { hasText: label }).locator("dd");

test("a vendor buys cards at the table and checks the cash box at close", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  // Opening the store started a cash box; the float goes in from here.
  const box = page.getByRole("region", { name: "Cash box" });
  await box.getByRole("button", { name: "Add float" }).click();
  await box.getByLabel("Float", { exact: true }).fill("100");
  await box.getByRole("button", { name: "Save" }).click();
  await expect(figure(box, "Float")).toHaveText("$100.00");

  // $265.50 in cash.
  await reviewSale(page, browser, slug, ["Charizard ex"]);
  await pay(page, "Cash");
  await confirmAndView(page);
  await expect(page.getByTestId("receipt-no")).toHaveText("R-0001");

  // Two Mews from stock at $5 and a new item at $3, paid in cash.
  await page.goto("/dashboard/inventory");
  await page.getByRole("link", { name: "Buy", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Buy" })).toBeVisible();
  await page.getByLabel("Find it in your stock").fill("mew");
  await page.getByRole("button", { name: /^Add Mew ex, NM/ }).click();
  await page.getByLabel("Qty, Mew ex").fill("2");
  await page.getByLabel("Paid each, Mew ex").fill("5");
  await page.getByRole("button", { name: "New item" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Pikachu promo");
  await page.getByRole("button", { name: "Add to buy" }).click();
  await page.getByLabel("Paid each, Pikachu promo").fill("3");
  await pay(page, "Cash");
  await page.getByLabel("Seller (optional)").fill("Sam");
  await page
    .getByRole("button", { name: "Record buy, 3 items, $13.00" })
    .click();
  await expect(
    page.getByText("Bought 3 items for $13.00. They're in stock."),
  ).toBeVisible();

  await page.goto("/dashboard/inventory");
  await expect(
    page.getByRole("group", { name: "Quantity, Mew ex" }).getByRole("status"),
  ).toHaveText("3");
  await expect(
    page
      .getByRole("group", { name: "Quantity, Pikachu promo" })
      .getByRole("status"),
  ).toHaveText("1");

  await page.goto("/dashboard/ledger");
  await expect(figure(page, "Paid out")).toHaveText("$13.00");
  // Buys are money out, not takings.
  await expect(figure(page, "Takings, after discounts")).toHaveText("$265.50");
  await expect(
    page.getByRole("list", { name: "Buys" }).getByRole("listitem"),
  ).toContainText("from Sam");
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: "Mew ex" })
      .filter({ hasText: "Bought" }),
  ).toContainText("+2");

  // Expected: $100 float + $265.50 cash sale - $13 cash buy.
  await page.goto("/dashboard");
  await expect(figure(box, "Should be in the box")).toHaveText("$352.50");
  await setStore(page, "off");
  await box.getByLabel("Cash you counted").fill("350");
  await box.getByRole("button", { name: "Save count" }).click();
  await expect(
    box.getByText(
      "Cash check saved. Counted $350.00, expected $352.50. $2.50 short.",
    ),
  ).toBeVisible();

  await page.goto("/dashboard/ledger");
  await expect(
    page.getByRole("list", { name: "Cash checks" }).getByRole("listitem"),
  ).toContainText("$2.50 short");
});
