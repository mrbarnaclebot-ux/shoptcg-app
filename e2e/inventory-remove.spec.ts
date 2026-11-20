import { expect, test, type Page } from "@playwright/test";
import { newVendor } from "./auth";
import { add, newBuyer, openVendor, reviewList, sendList } from "./buyer";

const row = (page: Page, name: string) =>
  page.locator("main li").filter({ hasText: name });

const qty = (page: Page, name: string) => row(page, name).locator("output");

/** Opens Edit on the row and taps Remove from inventory. */
async function remove(page: Page, name: string) {
  await row(page, name).getByRole("button", { name: "Edit" }).click();
  await row(page, name)
    .getByRole("button", { name: "Remove from inventory" })
    .click();
}

test("remove takes an item off at once, and Undo brings it back", async ({
  page,
}) => {
  await openVendor(page);
  await page.goto("/dashboard/inventory");
  await remove(page, "Gengar");
  await expect(row(page, "Gengar")).toHaveCount(0);
  await page
    .locator(".toasts li")
    .filter({ hasText: "Gengar is off your stock and store." })
    .getByRole("button", { name: "Undo" })
    .click();
  await expect(
    page.locator(".toasts").getByText("Gengar is back in your stock."),
  ).toBeVisible();
  await expect(qty(page, "Gengar")).toHaveText("2");
});

test("a removed item waits under Removed until it is restored", async ({
  page,
}) => {
  await openVendor(page);
  await page.goto("/dashboard/inventory");
  await remove(page, "Gengar");
  await expect(row(page, "Gengar")).toHaveCount(0);

  await page.getByRole("link", { name: "Removed", exact: true }).click();
  const gone = row(page, "Gengar");
  await expect(gone).toBeVisible();
  // No stepper, Sell or Edit on a removed item: only Restore.
  await expect(qty(page, "Gengar")).toHaveCount(0);
  await expect(gone.getByRole("button", { name: "Sell Gengar" })).toHaveCount(
    0,
  );
  await expect(gone.getByRole("button", { name: "Edit" })).toHaveCount(0);
  await gone.getByRole("button", { name: "Restore Gengar" }).click();
  await expect(gone).toHaveCount(0);

  await page.getByRole("link", { name: "All", exact: true }).click();
  await expect(qty(page, "Gengar")).toHaveText("2");
  await page.goto("/dashboard/ledger");
  const moves = page.locator("li").filter({ hasText: "Gengar" });
  await expect(moves.filter({ hasText: "Removed" })).toHaveCount(1);
  await expect(moves.filter({ hasText: "Restored" })).toHaveCount(1);
});

test("a buyer holding a removed item is told, live and when they come back", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  const buyer = await newBuyer(browser, slug);
  await sendList(buyer, slug, ["Charizard ex", "Gengar"]);

  // The vendor has the sale open while removing from another tab.
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Review sale" }).first().click();
  const sale = page.getByRole("main");
  await expect(sale.getByText("Charizard ex", { exact: true })).toBeVisible();
  const inventory = await page.context().newPage();
  await inventory.goto("/dashboard/inventory");
  await remove(inventory, "Charizard ex");
  await expect(
    row(inventory, "Charizard ex").getByText(
      "1 buyer has this on hold. Removing takes it off their request and tells them.",
    ),
  ).toBeVisible();
  await row(inventory, "Charizard ex")
    .getByRole("button", { name: "Remove", exact: true })
    .click();
  await expect(row(inventory, "Charizard ex")).toHaveCount(0);

  const said = "Charizard ex was removed from the store.";
  await expect(buyer.locator(".toasts").getByText(said)).toBeVisible();
  await expect(buyer.getByRole("main").getByText(said)).toBeVisible();
  // The rest of the request is still held, and the note stays on it.
  await buyer.reload();
  await expect(buyer.getByRole("heading", { name: /^Sent to/ })).toBeVisible();
  await expect(buyer.getByRole("main").getByText(said)).toBeVisible();
  await expect(sale.getByText("Charizard ex", { exact: true })).toHaveCount(0);
  await expect(sale.getByText("Gengar", { exact: true })).toBeVisible();
});

test("a buyer's cart drops a removed item and says so", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  const buyer = await newBuyer(browser, slug);
  // The cart reaches the vendor's floor a moment after it changes.
  const synced = buyer.waitForRequest(
    (r) =>
      r.url().endsWith("/api/visit") &&
      JSON.parse(r.postData() ?? "{}").lines?.length === 2,
  );
  await add(buyer, "Gengar");
  await add(buyer, "Mew ex");
  await synced;
  await reviewList(buyer);

  await page.goto("/dashboard/inventory");
  await remove(page, "Gengar");
  await expect(
    row(page, "Gengar").getByText("1 buyer has this on hold."),
  ).toBeVisible();
  await row(page, "Gengar")
    .getByRole("button", { name: "Remove", exact: true })
    .click();
  await expect(row(page, "Gengar")).toHaveCount(0);

  const said = buyer
    .getByRole("alert")
    .filter({ hasText: "Gengar was removed from the store." });
  await buyer.reload();
  await expect(said).toBeVisible();
  await expect(
    buyer.getByRole("button", { name: "Remove Gengar" }),
  ).toHaveCount(0);
  await expect(
    buyer.getByRole("button", { name: "Remove Mew ex" }),
  ).toBeVisible();
  // Gone from the phone too: nothing to say the next time.
  await buyer.reload();
  await expect(
    buyer.getByRole("button", { name: "Remove Mew ex" }),
  ).toBeVisible();
  await expect(said).toHaveCount(0);
});

test("Edit sets a typed quantity, and a custom item's name", async ({
  page,
}) => {
  await openVendor(page);
  await page.goto("/dashboard/inventory");
  await row(page, "Gengar").getByRole("button", { name: "Edit" }).click();
  await row(page, "Gengar").getByLabel("Quantity", { exact: true }).fill("17");
  await row(page, "Gengar")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(qty(page, "Gengar")).toHaveText("17");
  await page.reload();
  await expect(qty(page, "Gengar")).toHaveText("17");

  const custom = row(page, "Pikachu Gold Star CN promo");
  await custom.getByRole("button", { name: "Edit" }).click();
  await custom.getByLabel("Name", { exact: true }).fill("Pikachu Gold Star");
  await custom.getByLabel("Number", { exact: true }).fill("SM-P 2");
  await custom.getByRole("button", { name: "Save", exact: true }).click();
  await expect(row(page, "Pikachu Gold Star")).toContainText("SM-P 2");

  await page.goto("/dashboard/ledger");
  await expect(
    page
      .locator("li")
      .filter({ hasText: "Gengar" })
      .filter({ hasText: "Adjusted" }),
  ).toHaveCount(1);
});

test("adding a card you already have tops it up instead of a second row", async ({
  page,
}) => {
  await newVendor(page);
  expect((await page.request.post("/api/e2e/seed")).ok()).toBe(true);
  await page.goto("/dashboard/inventory/add");
  await page.getByLabel("Search the catalog").fill("151 mew");
  await page
    .getByRole("list")
    .getByRole("button", { name: /^Mew ex 151 #205/ })
    .click();
  await page.getByRole("button", { name: "Add to stock" }).click();
  await expect(page.getByText("Added to your Mew ex: 1 → 2.")).toBeVisible();

  await page.goto("/dashboard/inventory");
  await expect(row(page, "Mew ex")).toHaveCount(1);
  await expect(qty(page, "Mew ex")).toHaveText("2");
});
