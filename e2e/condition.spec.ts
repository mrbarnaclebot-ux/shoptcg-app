import { expect, test } from "@playwright/test";
import { newVendor } from "./auth";
import { setStore } from "./buyer";

test("played cards follow the store's share of Near Mint, and items show recent sales", async ({
  page,
  browser,
}) => {
  const id = await newVendor(page);
  const slug = `e2e-${id}`;
  const res = await page.request.post("/api/e2e/seed");
  const seeded = (await res.json()) as { zard: string; sold: string };
  await page.goto("/dashboard");
  await setStore(page, "open");

  await page.goto("/dashboard/settings/pricing");
  const lp = page.getByLabel("Lightly Played (LP), %");
  await expect(lp).toHaveValue("85");
  await lp.fill("150");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator("#condLpPct-error")).toHaveText(
    "Between 1 and 100",
  );
  await lp.fill("50");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved.", { exact: true })).toBeVisible();

  const buyer = await (await browser.newContext()).newPage();
  // The LP Pikachu is priced off Near Mint, and says so.
  await buyer.goto(`/${slug}/item/${seeded.sold}`);
  await expect(
    buyer.getByText("Lightly Played is priced at 50% of the Near Mint market."),
  ).toBeVisible();

  // A Near Mint single: no share note, and the last week's market sales.
  await buyer.goto(`/${slug}/item/${seeded.zard}`);
  await expect(
    buyer.getByText(/is priced at \d+% of the Near Mint/),
  ).toHaveCount(0);
  const sales = buyer.getByRole("region", { name: "Recent sales" });
  await expect(sales).toContainText("Near Mint copies on TCGplayer");
  // Seeded: 1 to 3 copies a day over the last week; days with none are left out.
  await expect(sales.getByRole("row")).toHaveCount(1 + 5);
});
