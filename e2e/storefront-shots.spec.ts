import { test, type Page } from "@playwright/test";
import { openVendor } from "./buyer";
import { mixStock } from "./db";

// Before/after screenshots for the storefront pass, not a regression test:
//   SHOTS=storefront SHOTS_DIR=<dir> pnpm e2e storefront-shots
const OUT = process.env.SHOTS_DIR ?? "test-results/storefront-shots";

test.skip(process.env.SHOTS !== "storefront", "set SHOTS=storefront");
test.setTimeout(240_000);

async function shot(page: Page, name: string, width: number, full = true) {
  await page.addStyleTag({ content: "nextjs-portal { display: none }" });
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: `${OUT}/${name}-${width}.jpg`,
    quality: 80,
    fullPage: full,
  });
}

test("storefront at three widths", async ({ page, browser }) => {
  const slug = await openVendor(page);
  const long = await mixStock(slug);
  for (const width of [390, 768, 1280]) {
    const height = width < 600 ? 844 : width < 1000 ? 1024 : 800;
    const buyer = await (
      await browser.newContext({ viewport: { width, height } })
    ).newPage();
    await buyer.goto(`/${slug}`);
    await shot(buyer, "store", width);
    await buyer.goto(`/${slug}/item/${long}`);
    await shot(buyer, "item-long", width, false);
    await buyer.goto(`/${slug}`);
    await buyer.getByRole("link", { name: /Charizard ex/ }).first().click();
    await buyer.waitForURL(/\/item\//);
    await shot(buyer, "item", width, false);
    await buyer.context().close();
  }
});
