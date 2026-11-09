import { test, type Page } from "@playwright/test";
import { newBuyer, openVendor, sendList, setStore } from "./buyer";

// Store state screenshots, not a regression test:
//   SHOTS=states pnpm e2e store-states-shots
const OUT = ".planning/phases/store-states/shots";

test.skip(process.env.SHOTS !== "states", "set SHOTS=states");
test.setTimeout(180_000);

// The viewport only: the control is the first thing on the dashboard.
const shot = async (page: Page, name: string, width: number, full = false) => {
  await page.addStyleTag({ content: "nextjs-portal { display: none }" });
  await page.waitForTimeout(800);
  await page.screenshot({
    path: `${OUT}/${name}-${width}.png`,
    fullPage: full,
  });
};

for (const width of [390, 1280]) {
  test(`store states at ${width}`, async ({ page, browser }) => {
    const height = width < 600 ? 844 : 800;
    await page.setViewportSize({ width, height });
    const slug = await openVendor(page);
    const buyer = await newBuyer(browser, slug);
    await buyer.setViewportSize({ width, height });
    await sendList(buyer, slug, ["Mew ex"]);

    await page.goto("/dashboard");
    await shot(page, "control-open", width);
    const control = page.getByRole("region", { name: "Your store" });
    await control.getByRole("button", { name: "Pause", exact: true }).click();
    await shot(page, "control-pause-ask", width);
    await control
      .getByRole("group", { name: "Pause for" })
      .getByRole("button", { name: "15 min" })
      .click();
    await page.waitForTimeout(4500); // let the toast clear
    await page.reload();
    await shot(page, "control-paused", width);

    await buyer.goto(`/${slug}`);
    await shot(buyer, "store-paused", width);

    await setStore(page, "off");
    await page.waitForTimeout(4500);
    await page.reload();
    await shot(page, "control-off", width);
    await buyer.goto(`/${slug}?src=sign`);
    await shot(buyer, "store-off", width, true);
  });
}
