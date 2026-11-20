import { expect, test, type Page } from "@playwright/test";
import { openVendor, sendList } from "./buyer";
import { mixStock, openedHoursAgo } from "./db";
import { saveSettings } from "./settings";

/** Top, height and the add button's top for every tile, grouped by row. */
async function rows(page: Page) {
  const boxes = await page.locator("[data-tile]").evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      const b = el.querySelector("button")?.getBoundingClientRect();
      return { top: Math.round(r.top), h: r.height, btn: b ? b.top : null };
    }),
  );
  const by = new Map<number, typeof boxes>();
  for (const b of boxes) by.set(b.top, [...(by.get(b.top) ?? []), b]);
  return [...by.values()];
}

test("add to cart from a tile; the old list link lands on the cart", async ({
  page,
  browser,
  request,
}) => {
  const slug = await openVendor(page);
  const buyer = await (await browser.newContext()).newPage();
  await buyer.goto(`/${slug}`);
  await buyer.getByRole("button", { name: "Add Mew ex to your cart" }).click();
  await expect(
    buyer.getByRole("status").filter({ hasText: "Your cart" }),
  ).toContainText("1 item, $48.10");

  const res = await request.get(`/${slug}/list?ids=x`, { maxRedirects: 0 });
  expect(res.status()).toBe(308);
  expect(res.headers().location).toMatch(new RegExp(`/${slug}/cart\\?ids=x$`));
  await buyer.goto(`/${slug}/list`);
  // The cart then writes its ids into the URL, so either is a landing.
  await expect(buyer).toHaveURL(new RegExp(`/${slug}/cart(\\?ids=[^&]+)?$`));
  await expect(buyer.getByRole("heading", { name: "Your cart" })).toBeVisible();
  await expect(buyer.getByText("Mew ex", { exact: true })).toBeVisible();
});

test("the item page: zoom, details, add a quantity, back to the same filters", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  const buyer = await (
    await browser.newContext({ viewport: { width: 390, height: 844 } })
  ).newPage();
  await buyer.goto(`/${slug}?type=raw`);
  await buyer
    .getByRole("link", { name: /Charizard ex/ })
    .first()
    .click();
  await expect(buyer).toHaveTitle(/^Charizard ex - E2E Cards/);
  await expect(buyer.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /tcgdex/,
  );
  await expect(buyer.getByText("Near Mint (NM)")).toBeVisible();

  await buyer
    .getByRole("button", { name: "View Charizard ex full size" })
    .click();
  await expect(buyer.getByRole("dialog")).toBeVisible();
  await buyer.keyboard.press("Escape");
  await expect(buyer.getByRole("dialog")).toBeHidden();

  // Three left: pick two, add, then the bar goes to the cart.
  await buyer
    .getByRole("group", { name: "Quantity of Charizard ex" })
    .getByRole("button", { name: "One more" })
    .click();
  await buyer.getByRole("button", { name: "Add to cart" }).click();
  await expect(buyer.getByText("2 in your cart")).toBeVisible();
  await expect(buyer.getByRole("link", { name: "Review cart" })).toBeVisible();

  await buyer.getByRole("link", { name: "Back to store" }).click();
  await expect(buyer).toHaveURL(new RegExp(`/${slug}\\?type=raw$`));
  await expect(
    buyer.getByRole("status").filter({ hasText: "Your cart" }),
  ).toContainText("2 items, $531");
});

test("online mode: the copy says order, the hold is a day, no 14-hour pause", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  await saveSettings(page, { table: "B14" });
  const buyer = await (await browser.newContext()).newPage();
  await buyer.goto(`/${slug}`);
  await expect(buyer.getByText("B14")).toBeVisible();

  await saveSettings(page, { mode: "Online store" });
  await expect(page.getByText(/arrange payment and pickup/)).toBeVisible();
  await buyer.reload();
  await expect(buyer.getByText("B14")).toHaveCount(0);
  await sendList(buyer, slug, ["Mew ex"]);
  await expect(buyer.getByText("Your order code")).toBeVisible();
  await expect(
    buyer.getByText(/confirm your order and email you to arrange payment/),
  ).toBeVisible();
  await expect(buyer.getByTestId("hold-clock")).toHaveText(/^2[34]:\d\d:\d\d$/);

  // A table store would have paused itself by now; an online one stays open.
  await openedHoursAgo(slug, 20);
  await buyer.goto(`/${slug}`);
  await expect(buyer.getByText("Browsing only.")).toHaveCount(0);
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: /On your page/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Your store" }),
  ).toHaveAttribute("data-state", "open");

  await saveSettings(page, { mode: "At a table" });
  await buyer.goto(`/${slug}`);
  await expect(buyer.getByText("Browsing only.")).toBeVisible();
});

test("every tile in a row is the same size, buttons in line", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  await mixStock(slug);
  for (const width of [390, 768, 1280]) {
    const buyer = await (
      await browser.newContext({ viewport: { width, height: 900 } })
    ).newPage();
    await buyer.goto(`/${slug}`);
    await expect(buyer.locator("[data-tile]")).toHaveCount(9);
    // Streamed in hidden, then revealed: measure once it is on screen.
    await expect(buyer.locator("[data-tile]").last()).toBeVisible();
    // content-visibility skips off-screen tiles; scroll them all into layout.
    await buyer.evaluate(() =>
      document
        .querySelectorAll("[data-tile]")
        .forEach(
          (t) => ((t as HTMLElement).style.contentVisibility = "visible"),
        ),
    );
    const grid = await rows(buyer);
    expect(grid.length).toBeGreaterThan(1);
    const heights = grid.flat().map((b) => b.h);
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(1);
    for (const row of grid) {
      const tops = row.flatMap((b) => (b.btn === null ? [] : [b.btn]));
      if (tops.length > 1)
        expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(1);
    }
    await buyer.context().close();
  }
});
