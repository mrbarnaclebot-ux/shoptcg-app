import { test, type Page } from "@playwright/test";
import { newVendor } from "./auth";
import { setStore } from "./buyer";
import { saveSettings } from "./settings";

// Phase 4 screenshots, not a regression test:
//   SHOTS=store pnpm e2e store-shots
const OUT = ".planning/phases/04-store-page/shots";

test.skip(process.env.SHOTS !== "store", "set SHOTS=store");
test.setTimeout(240_000);

async function shot(page: Page, name: string, width: number) {
  await page.addStyleTag({ content: "nextjs-portal { display: none }" });
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => window.scrollTo(0, 0));
  // Card art screens go to JPEG so each file stays under 400 KB.
  const ext = name === "sign-print" || name === "sign" ? "png" : "jpg";
  await page.screenshot({
    path: `${OUT}/${name}-${width}.${ext}`,
    ...(ext === "jpg" && { quality: 82 }),
  });
}

async function settings(page: Page, open: boolean) {
  await saveSettings(page, {
    currency: ["AUD", "1.52"],
    table: "B14",
    nfc: true,
  });
  await page.goto("/dashboard");
  if (open) await setStore(page, "open");
}

for (const width of [390, 768, 1280]) {
  test(`store page at ${width}`, async ({ page, browser }) => {
    const height = width < 600 ? 844 : width < 1000 ? 1024 : 800;
    const id = await newVendor(page);
    const slug = `e2e-${id}`;
    const ids = await (await page.request.post("/api/e2e/seed")).json();
    await settings(page, false);

    const buyer = await (
      await browser.newContext({ viewport: { width, height } })
    ).newPage();
    await buyer.goto(`/${slug}`);
    await shot(buyer, "store-closed", width);

    await settings(page, true);
    await buyer.goto(`/${slug}`);
    await buyer
      .getByRole("button", { name: "Add Charizard ex to your list" })
      .click();
    await buyer
      .getByRole("button", { name: "Add Mew ex to your list" })
      .click();
    await shot(buyer, "store", width);

    await buyer.goto(`/${slug}/item/${ids.zard}`);
    await shot(buyer, "item", width);

    await page.setViewportSize({ width, height });
    await page.goto("/dashboard/sign");
    await shot(page, "sign", width);
    await page.emulateMedia({ media: "print" });
    await page.setViewportSize({ width: 560, height: 794 });
    await shot(page, "sign-print", width);
  });
}
