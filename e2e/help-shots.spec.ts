import { expect, test, type Locator, type Page } from "@playwright/test";
import { add, newBuyer, openVendor, reviewList, sendList } from "./buyer";

// The pictures on /help, not a regression test. After a UI change, rerun:
//   SHOTS=help pnpm e2e help-shots
// Phone width, JPEG, into public/help/.
const OUT = "public/help";

test.skip(process.env.SHOTS !== "help", "set SHOTS=help");
test.setTimeout(240_000);

async function shot(target: Page | Locator, name: string) {
  const page = "page" in target ? target.page() : target;
  await page.addStyleTag({
    content:
      "nextjs-portal, nav[aria-label=Dashboard] { display: none !important } *, *::after { transition: none !important; animation: none !important }",
  });
  await page.waitForTimeout(300);
  await target.screenshot({ path: `${OUT}/${name}.jpg`, quality: 80 });
}

test("help page pictures", async ({ page, browser }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const slug = await openVendor(page);
  // A believable name for the pictures, and a table number for the sign.
  await page.goto("/dashboard/settings/store");
  await page.getByLabel("Store name").fill("Pallet Town Cards");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved.", { exact: true })).toBeVisible();

  await page.goto("/dashboard");
  await shot(page.getByRole("region", { name: "Getting started" }), "tips");
  await shot(page.getByRole("region", { name: "Your store" }), "store-control");

  await page.goto("/dashboard/inventory/add");
  await page.getByLabel("Search the catalog").fill("charizard");
  await expect(
    page
      .getByRole("list")
      .getByRole("button", { name: /^Charizard Base Set #4/ }),
  ).toBeVisible();
  await shot(page, "add-stock");

  await page.goto("/dashboard/settings/pricing");
  await shot(page, "pricing");
  await page.goto("/dashboard/settings/table");
  await shot(page, "how-you-sell");

  // The buyer's side: the store, then the cart.
  const buyer = await newBuyer(browser, slug);
  await buyer.setViewportSize({ width: 390, height: 844 });
  await shot(buyer, "buyer-store");
  await add(buyer, "Mew ex");
  await reviewList(buyer);
  await shot(buyer, "buyer-cart");
  await sendList(buyer, slug, ["Charizard ex"]);

  // The cart lands on the dashboard; open it to confirm.
  await page.goto("/dashboard");
  const review = page.getByRole("link", { name: "Review sale" }).first();
  await expect(review).toBeVisible();
  await review.scrollIntoViewIfNeeded();
  await shot(page, "request");
  await review.click();
  await expect(page.getByRole("heading", { name: /^Sale for/ })).toBeVisible();
  await shot(page, "confirm-sale");

  // Quick sale: tap Sell in Inventory and the table-sale bar appears.
  await page.goto("/dashboard/inventory");
  await page.getByRole("button", { name: "Sell Umbreon VMAX" }).click();
  await expect(page.getByRole("link", { name: /^Table sale/ })).toContainText(
    "1 item",
  );
  await shot(page, "quick-sale");

  await page.goto("/dashboard");
  await shot(page.getByRole("region", { name: "Cash box" }), "cash-box");
  await page.goto("/dashboard/settings/alerts");
  await shot(page, "alerts");
});
