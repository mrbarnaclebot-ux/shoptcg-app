import { expect, test, type Page } from "@playwright/test";
import { confirmAndView, newBuyer, openVendor, sendList } from "./buyer";

// Phase 6 screenshots, not a regression test:
//   SHOTS=sales pnpm e2e sales-shots
const OUT = ".planning/phases/06-sales/shots";

test.skip(process.env.SHOTS !== "sales", "set SHOTS=sales");
test.setTimeout(120_000);

const shot = async (page: Page, name: string, width: number) => {
  await page.addStyleTag({ content: "nextjs-portal { display: none }" });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: `${OUT}/${name}-${width}.png`,
    fullPage: true,
  });
};

for (const width of [390, 768, 1280]) {
  test(`sale screens at ${width}`, async ({ page, browser }) => {
    const size = { width, height: 900 };
    await page.setViewportSize(size);
    const slug = await openVendor(page);
    const buyer = await newBuyer(browser, slug);
    await buyer.setViewportSize(size);
    await sendList(buyer, slug, ["Charizard ex", "Gengar", "Mew ex"], {
      promo: true,
    });
    await shot(buyer, "waiting", width);
    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: "Review sale" })).toBeVisible();
    await shot(page, "queue", width);
    await page.getByRole("link", { name: "Review sale" }).click();
    await page.getByLabel("Price each for Charizard ex").fill("240");
    await page.getByText("%", { exact: true }).click();
    await page.getByLabel("Percent off").fill("10");
    await page.getByText("Cash").click();
    await shot(page, "confirm", width);
    // What the seller sees at the end of the form: the sticky Confirm over the total?
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
    await page.screenshot({ path: `${OUT}/confirm-end-${width}.png` });
    await confirmAndView(page);
    await expect(page.getByTestId("receipt-no")).toHaveText("R-0001");
    await expect(page.getByText(/^Emailed to/)).toBeVisible();
    await shot(page, "receipt", width);
    await expect(buyer.getByText("Sold. Enjoy your cards!")).toBeVisible();
    await shot(buyer, "buyer-confirmed", width);
    await page.goto("/dashboard/sales");
    await shot(page, "sales", width);
  });
}
