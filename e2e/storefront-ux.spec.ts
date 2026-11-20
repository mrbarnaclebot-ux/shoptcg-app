import { expect, test } from "@playwright/test";
import { add, newBuyer, openVendor, reviewList, sendList } from "./buyer";
import { bulkStock } from "./db";
import { saveSettings } from "./settings";

test("a sent request links back from the store and cart until it stops waiting", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  await saveSettings(page, { table: "B14" });
  const buyer = await newBuyer(browser, slug);
  const code = await sendList(buyer, slug, ["Mew ex"]);
  // Where to walk to, from the first minute.
  await expect(buyer.getByTestId("stub-table")).toContainText("B14");

  await buyer.getByRole("link", { name: /^Back to / }).click();
  await expect(buyer).toHaveURL(new RegExp(`/${slug}$`));
  const stub = buyer.getByRole("link", {
    name: new RegExp(`^Request ${code} waiting`),
  });
  await expect(stub).toBeVisible();
  await buyer.goto(`/${slug}/cart`);
  await expect(stub).toBeVisible();
  await stub.click();
  await expect(buyer.getByTestId("request-code")).toHaveText(code);

  await buyer.getByRole("button", { name: "Cancel request" }).click();
  await buyer.getByRole("button", { name: "Yes, cancel" }).click();
  await expect(
    buyer.getByRole("heading", { name: "Request cancelled." }),
  ).toBeVisible();
  await buyer.goto(`/${slug}`);
  await expect(
    buyer.getByRole("button", { name: "Add Mew ex to your cart" }),
  ).toBeVisible();
  await expect(stub).toHaveCount(0);
});

test("desktop item page: the action sits by the price, the seller under the way back", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  await saveSettings(page, { table: "B14" });
  const buyer = await newBuyer(browser, slug);
  // A slab's grade leads its tile; two at one grade differ by card.
  await expect(
    buyer.locator("[data-tile]").filter({ hasText: "Umbreon VMAX" }),
  ).toContainText("PSA 10 · Evolving Skies 215");

  await buyer
    .getByRole("link", { name: /Charizard ex/ })
    .first()
    .click();
  await expect(buyer).toHaveTitle(/^Charizard ex/);
  const action = buyer.getByRole("button", { name: "Add to cart" });
  await expect(action).toBeVisible();
  const box = (await action.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(buyer.viewportSize()!.height);
  await expect(buyer.getByText("Table B14", { exact: true })).toBeVisible();
  await expect(
    buyer.getByRole("main").getByText("Open", { exact: true }),
  ).toBeVisible();
  // The grade says what it means, and the set browses the rest of it.
  await expect(
    buyer.getByText("Looks unplayed. A tiny flaw at most."),
  ).toBeVisible();
  await buyer.getByRole("link", { name: "151", exact: true }).click();
  await expect(buyer).toHaveURL(new RegExp(`/${slug}\\?q=151$`));
  await expect(
    buyer.getByRole("button", { name: "Add Mew ex to your cart" }),
  ).toBeVisible();
  await expect(buyer.getByText("Umbreon VMAX")).toHaveCount(0);
});

test("the cart fills in from last time, and Not you clears it", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  const buyer = await newBuyer(browser, slug);
  await sendList(buyer, slug, ["Mew ex"], {
    name: "Ana Reyes",
    email: "ana@example.test",
  });

  await buyer.goto(`/${slug}`);
  await add(buyer, "Charizard ex");
  await reviewList(buyer);
  const name = buyer.getByLabel("Your name");
  await expect(name).toHaveValue("Ana Reyes");
  await expect(buyer.getByLabel("Email for your receipt")).toHaveValue(
    "ana@example.test",
  );
  await buyer.getByRole("button", { name: "Not you? Clear" }).click();
  await expect(name).toHaveValue("");
  await expect(name).toBeFocused();
  await buyer.reload();
  await expect(buyer.getByRole("heading", { name: "Your cart" })).toBeVisible();
  await expect(buyer.getByText("Charizard ex", { exact: true })).toBeVisible();
  await expect(name).toHaveValue("");
  await expect(
    buyer.getByRole("button", { name: "Not you? Clear" }),
  ).toHaveCount(0);
});

test("a store past a thousand items pages, keeping the sort", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  await bulkStock(slug, 1001);
  const buyer = await newBuyer(browser, slug);
  await buyer.goto(`/${slug}?sort=name`);
  const pages = buyer.getByRole("navigation", { name: "Pages" });
  await expect(pages).toContainText(/^1 to 1,000 of 1,0\d\d/);
  const total = Number(
    (await pages.locator("p").textContent())!.split(" of ")[1].replace(",", ""),
  );
  await expect(buyer.locator("[data-tile]")).toHaveCount(1000);

  await pages.getByRole("link", { name: "Next" }).click();
  await expect(buyer).toHaveURL(new RegExp(`/${slug}\\?sort=name&page=2$`));
  await expect(pages).toContainText(
    `1,001 to ${total.toLocaleString("en-US")}`,
  );
  await expect(buyer.locator("[data-tile]")).toHaveCount(total - 1000);
  await expect(pages.getByRole("link", { name: "Next" })).toHaveCount(0);

  // A new filter starts again at the first page.
  await buyer.getByRole("link", { name: "Raw", exact: true }).click();
  await expect(buyer).toHaveURL(new RegExp(`/${slug}\\?type=raw&sort=name$`));
});
