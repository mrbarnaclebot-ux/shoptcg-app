import { expect, test, type Page, type Route } from "@playwright/test";
import { confirm, newBuyer, openVendor, pay, reviewSale } from "./buyer";

const toast = (page: Page) => page.locator(".toasts");
const result = (page: Page, name: RegExp) =>
  page.getByRole("list").getByRole("button", { name });

test("after a sale the vendor is back where it started, and the toast opens the receipt", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  await reviewSale(page, browser, slug, ["Mew ex"]);
  await pay(page, "Cash");
  await confirm(page).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(toast(page)).toContainText("Sale R-0001 recorded");
  await page.getByRole("button", { name: "View receipt" }).click();
  await expect(page.getByTestId("receipt-no")).toHaveText("R-0001");

  // A table sale goes back to the inventory it started from.
  await page.goto("/dashboard/inventory");
  await page.getByRole("button", { name: "Sell Gengar" }).click();
  await page.getByRole("link", { name: /^Table sale/ }).click();
  await pay(page, "Card");
  await confirm(page).click();
  await expect(page).toHaveURL(/\/dashboard\/inventory$/);
  await expect(toast(page)).toContainText("Sale R-0002 recorded");

  // Both receipts are on Sales, without the toast.
  await page.goto("/dashboard/sales");
  await expect(page.locator("main li")).toHaveCount(2);
  await page.locator("main li a", { hasText: "R-0002" }).click();
  await expect(page.getByTestId("receipt-no")).toHaveText("R-0002");
});

test("cash given shows the change, and the sticky bar doesn't cover it", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  await reviewSale(page, browser, slug, ["Charizard ex"]);
  await expect(page.getByText("Cash given")).toHaveCount(0);
  await pay(page, "Cash");
  const notes = page.getByRole("group", { name: "Cash given" });
  // $265.50: Exact, then the next notes up.
  await expect(notes.getByRole("button")).toHaveText([
    "Exact",
    "$270.00",
    "$280.00",
    "$300.00",
  ]);
  await notes.getByRole("button", { name: "Exact" }).click();
  await expect(page.getByText("Change: $0.00")).toBeVisible();
  await page.getByRole("textbox", { name: "Cash given" }).fill("250");
  await expect(page.getByText("$15.50 short")).toBeVisible();
  await notes.getByRole("button", { name: "$280.00" }).click();
  await expect(notes.getByRole("button", { name: "$280.00" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const change = page.getByText("Change: $14.50");
  await change.scrollIntoViewIfNeeded();
  await expect(change).toBeInViewport();
  // The Confirm bar is pinned to the bottom; the change sits clear of it.
  const bar = await confirm(page).boundingBox();
  const line = await change.boundingBox();
  expect(line!.y + line!.height).toBeLessThanOrEqual(bar!.y);
  await confirm(page).click();
  await expect(toast(page)).toContainText("Change $14.50.");
});

test("a sale confirmed offline is kept on the phone and recorded once when it's back", async ({
  page,
  browser,
  context,
}) => {
  const slug = await openVendor(page);
  const buyer = await reviewSale(page, browser, slug, ["Charizard ex"]);
  await pay(page, "Cash");
  await context.setOffline(true);
  await confirm(page).click();
  await expect(
    page.getByText("Saved on this phone. It sends when you're back online."),
  ).toBeVisible();
  await expect(confirm(page)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Waiting to send" }),
  ).toBeDisabled();

  // Back online but the server still can't be reached: it stays queued.
  const blocked = (r: Route) =>
    r.request().method() === "POST"
      ? r.abort("internetdisconnected")
      : r.continue();
  await page.route("**/*", blocked);
  await context.setOffline(false);
  await page.goto("/dashboard");
  await expect(page.getByText("1 sale waiting to sync")).toBeVisible();

  await page.unroute("**/*", blocked);
  await page.getByRole("button", { name: "Send now" }).click();
  await expect(toast(page)).toContainText("Sale R-0001 recorded");
  await expect(page.getByText("waiting to sync")).toHaveCount(0);
  await expect(buyer.getByText("SOLD", { exact: true })).toBeVisible();
  await page.goto("/dashboard/sales");
  await expect(page.locator("main li")).toHaveCount(1);
});

test("+15 min pushes a buyer's hold back, up to an hour", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  await reviewSale(page, browser, slug, ["Mew ex"]);
  const more = page.getByRole("button", { name: "+15 min on the hold" });
  for (const added of [15, 30, 45]) {
    await more.click();
    await expect(page.getByText(`${added} min added.`)).toBeVisible();
  }
  await more.click();
  await expect(
    page.getByText("60 min added, the most a hold can get."),
  ).toBeVisible();
  await expect(more).toHaveCount(0);
});

test("a card the buyer picks up at the table goes on the sale, held like the rest", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  await reviewSale(page, browser, slug, ["Pikachu"]);
  // One more Pikachu than asked: there are four in stock.
  const pika = page.getByRole("group", { name: "Quantity of Pikachu" });
  await pika.getByRole("button", { name: "One more" }).click();
  await expect(pika.locator("output")).toHaveText("2");

  await page.getByRole("button", { name: "Add item" }).click();
  await page.getByLabel("Add item").fill("mew");
  await page.getByRole("button", { name: /^Add Mew ex/ }).click();
  await expect(
    page.getByRole("group", { name: "Quantity of Mew ex" }),
  ).toBeVisible();
  // The only Mew is held now: another buyer can't take it.
  const other = await newBuyer(browser, slug);
  await expect(
    other.getByRole("button", { name: "Add Mew ex to your cart" }),
  ).toHaveCount(0);

  await pay(page, "Cash");
  // 2 x $18.50 + $48.10.
  await expect(confirm(page)).toHaveText(/\$85\.10/);
  await confirm(page).click();
  await page.getByRole("button", { name: "View receipt" }).click();
  await expect(page.getByTestId("receipt-no")).toHaveText("R-0001");
  // Earlier routes stay mounted but hidden.
  await expect(page.locator("main:visible")).toContainText("Mew ex");
  await expect(page.locator("main:visible")).toContainText("$85.10");
});

test("buying a catalog card shows its market and fills the offer", async ({
  page,
}) => {
  await openVendor(page);
  await page.goto("/dashboard/buy");
  await page.getByLabel("Search the catalog").fill("charizard 199");
  await result(page, /^Charizard ex 151 #199/).click();
  const bought = page.getByRole("list", { name: "Bought" });
  await expect(bought).toContainText("Market $295.00 (NM)");
  await bought.getByText("LP", { exact: true }).click();
  // LP is 85% of Near Mint by default.
  await expect(bought).toContainText("Market $250.75 (LP)");
  await bought.getByRole("button", { name: "Offer 70%" }).click();
  await expect(bought.getByLabel(/^Paid each/)).toHaveValue("175.53");
  await page
    .getByRole("button", { name: "Record buy, 1 item, $175.53" })
    .click();
  await expect(
    page.getByText("Bought 1 item for $175.53. They're in stock."),
  ).toBeVisible();

  // A new LP row at that cost, beside the NM one.
  await page.goto("/dashboard/inventory?q=charizard");
  await expect(
    page.getByRole("listitem").filter({ hasText: "Charizard ex" }),
  ).toHaveCount(2);
});

test("the add panel previews the price and remembers the condition", async ({
  page,
}) => {
  await openVendor(page);
  await page.goto("/dashboard/inventory/add");
  const box = page.getByLabel("Search the catalog");
  await box.fill("charizard 199");
  await result(page, /^Charizard ex 151 #199/).click();
  const preview = page.getByText(/^Market \$295\.00 \(NM\)/);
  await expect(preview).toHaveText("Market $295.00 (NM) → you sell at $295.00");
  await page.getByText("LP", { exact: true }).click();
  await expect(preview).toHaveText(
    "Market $295.00 (NM) → you sell LP at $250.75",
  );

  // The next card starts on LP.
  await page.reload();
  await page.getByLabel("Search the catalog").fill("mew 205");
  await result(page, /^Mew ex/).click();
  await expect(page.getByRole("radio", { name: "LP" })).toBeChecked();
  await expect(page.getByText(/^Market \$48\.10 \(NM\)/)).toHaveText(
    "Market $48.10 (NM) → you sell LP at $40.89",
  );
});

test("Sales steps back a day at a time, kept in the URL", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  await reviewSale(page, browser, slug, ["Gengar"]);
  await pay(page, "Cash");
  await confirm(page).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/dashboard/sales");
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Next day" })).toHaveCount(0);
  await page.getByRole("link", { name: "Previous day" }).click();
  await expect(page).toHaveURL(/\/dashboard\/sales\?day=\d{4}-\d{2}-\d{2}$/);
  await expect(page.getByText(/^No sales on \w+day, /)).toBeVisible();
  // A reload keeps the day.
  await page.reload();
  await expect(page.getByText(/^No sales on /)).toBeVisible();
  await page.getByRole("link", { name: "Next day" }).click();
  await expect(page).toHaveURL(/\/dashboard\/sales$/);
  await expect(page.locator("main li")).toHaveCount(1);
});
