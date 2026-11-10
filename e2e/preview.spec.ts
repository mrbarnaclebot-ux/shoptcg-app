import { expect, test } from "@playwright/test";
import { add, fillForm, openVendor, reviewList, sent, setStore } from "./buyer";

const CARD = "Charizard ex";

test("a vendor previews a closed store; buyers still see it closed", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  await setStore(page, "off");
  const buyer = await (await browser.newContext()).newPage();
  const closed = /isn.t vending right now/;
  await buyer.goto(`/${slug}`);
  await expect(buyer.getByText(closed)).toBeVisible();

  // Before preview is opened, the owner sees what buyers see.
  await page.goto(`/${slug}`);
  await expect(page.getByText(closed)).toBeVisible();

  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Preview", exact: true }).click();
  await expect(page.getByText(/Your store is not vending/)).toBeVisible();
  const frame = page.frameLocator("iframe");
  await expect(
    frame.getByRole("button", { name: `Add ${CARD} to your list` }),
  ).toBeVisible();
  // The dashboard already says "preview", so the frame carries no strip.
  await expect(frame.getByText("Exit preview")).toHaveCount(0);

  // Outside the frame the strip says what buyers get, and a sent list is a test.
  await page.goto(`/${slug}`);
  await expect(page.getByText(/Right now buyers see no stock/)).toBeVisible();
  await add(page, CARD);
  await reviewList(page);
  await fillForm(page);
  await page.getByRole("button", { name: "Send to seller" }).click();
  await sent(page);
  await page.goto("/dashboard");
  await expect(page.getByText("Test", { exact: true })).toBeVisible();

  // It changed nothing for buyers, and another vendor's cookie opens nothing.
  await buyer.reload();
  await expect(buyer.getByText(closed)).toBeVisible();
  const other = await (await browser.newContext()).newPage();
  await openVendor(other);
  await other.goto("/dashboard/preview");
  await expect(
    other.frameLocator("iframe").getByRole("heading"),
  ).not.toHaveCount(0);
  await other.goto(`/${slug}`);
  await expect(other.getByText(closed)).toBeVisible();

  await page.goto(`/${slug}`);
  await page.getByRole("link", { name: "Exit preview" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto(`/${slug}`);
  await expect(page.getByText(closed)).toBeVisible();
});
