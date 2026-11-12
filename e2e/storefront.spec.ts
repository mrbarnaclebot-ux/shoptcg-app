import { expect, test, type Page } from "@playwright/test";
import { openVendor } from "./buyer";
import { mixStock } from "./db";

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
  await buyer
    .getByRole("button", { name: "Add Mew ex to your cart" })
    .click();
  await expect(
    buyer.getByRole("status").filter({ hasText: "Your cart" }),
  ).toContainText("1 item, $48.10");

  const res = await request.get(`/${slug}/list?ids=x`, { maxRedirects: 0 });
  expect(res.status()).toBe(308);
  expect(res.headers().location).toMatch(new RegExp(`/${slug}/cart\\?ids=x$`));
  await buyer.goto(`/${slug}/list`);
  await expect(buyer).toHaveURL(new RegExp(`/${slug}/cart$`));
  await expect(buyer.getByRole("heading", { name: "Your cart" })).toBeVisible();
  await expect(buyer.getByText("Mew ex", { exact: true })).toBeVisible();
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
    // content-visibility skips off-screen tiles; scroll them all into layout.
    await buyer.evaluate(() =>
      document
        .querySelectorAll("[data-tile]")
        .forEach((t) => ((t as HTMLElement).style.contentVisibility = "visible")),
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
