import { expect, test, type Page } from "@playwright/test";
import {
  buyerEmail,
  confirmAndView,
  openVendor,
  outboxLine,
  pay,
  reviewSale,
} from "./buyer";
import { saveSettings } from "./settings";

// Phase 7 screenshots, not a regression test:
//   SHOTS=reports pnpm e2e reports-shots
const OUT = ".planning/phases/07-reports/shots";

test.skip(process.env.SHOTS !== "reports", "set SHOTS=reports");
test.setTimeout(180_000);

const shot = async (page: Page, name: string, width: number) => {
  await page.addStyleTag({ content: "nextjs-portal { display: none }" });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: `${OUT}/${name}-${width}.png`,
    fullPage: true,
  });
};

for (const width of [390, 768, 1280]) {
  test(`report screens at ${width}`, async ({ page, browser }) => {
    await page.setViewportSize({ width, height: 900 });
    const slug = await openVendor(page);
    await saveSettings(page, { table: "B-14" });
    await page.goto("/dashboard/reports");
    await shot(page, "report-empty", width);
    await page.goto("/dashboard/customers");
    await shot(page, "customers-empty", width);

    const sales = [
      {
        item: "Charizard ex",
        method: "Cash",
        promo: true,
        name: "Maya Robinson",
      },
      { item: "Pikachu", method: "Cash", promo: false, name: "Theo King" },
      { item: "Gengar", method: "Card", promo: true, name: "Sam Alvarez" },
    ];
    let last = "";
    for (const s of sales) {
      last = buyerEmail();
      await reviewSale(page, browser, slug, [s.item], {
        email: last,
        promo: s.promo,
        name: s.name,
      });
      await pay(page, s.method);
      await confirmAndView(page);
      await expect(page.getByTestId("receipt-no")).toBeVisible();
    }

    // Sam opts out, so the customers shot has all three consent states.
    const reader = await (await browser.newContext()).newPage();
    await reader.goto((await outboxLine(last)).split(" ")[2]);
    await reader.getByRole("button", { name: "Unsubscribe" }).click();
    await expect(
      reader.getByRole("heading", { name: /^You're off/ }),
    ).toBeVisible();

    await page.goto("/dashboard/reports");
    if (width === 390) {
      // What a phone shows without scrolling: Cash has to be above the tab bar.
      await page.setViewportSize({ width, height: 844 });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${OUT}/report-fold-${width}.png` });
      const cash = page.getByRole("row").nth(1);
      const box = await cash.boundingBox();
      const bar = await page.locator("nav[aria-label]").last().boundingBox();
      console.log("[fold] cash", box, "bar", bar);
      await page.setViewportSize({ width, height: 900 });
    }
    await page.locator("summary", { hasText: "R-0003." }).click();
    await shot(page, "report", width);
    await page.setViewportSize({ width, height: 700 });
    await page.getByRole("link", { name: "Export CSV" }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/report-toast-${width}.png` });
    await page.setViewportSize({ width, height: 900 });

    await page.goto("/dashboard/customers");
    await page.getByRole("button", { name: "Remove Theo King" }).click();
    await shot(page, "customers", width);
  });
}
