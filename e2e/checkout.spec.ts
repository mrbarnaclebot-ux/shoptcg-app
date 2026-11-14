import { expect, test } from "@playwright/test";
import {
  add,
  confirm,
  fillForm,
  newBuyer,
  openVendor,
  reviewList,
  sent,
} from "./buyer";
import { saveSettings } from "./settings";

const BANK = "Commercial Bank, Nugegoda\nE2E Cards\n8001234567";

test("an online buyer picks delivery and bank transfer, then sees where to pay", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  await saveSettings(page, { mode: "Online store" });
  const online = page.getByRole("group", { name: "Online orders" });
  for (const opt of [
    "Delivery",
    "Pickup",
    "Cash on delivery or at pickup",
    "Bank transfer",
  ])
    await online.getByLabel(new RegExp(`^${opt}`)).check();
  // Transfer without an account to pay into is refused.
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator("#bank-error")).toHaveText(/Add the account/);
  await page.getByLabel("Bank details").fill(BANK);
  await page
    .getByLabel("Note for buyers (optional)")
    .fill("PickMe Flash in Colombo, fee on arrival.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved.", { exact: true })).toBeVisible();

  const buyer = await newBuyer(browser, slug);
  await add(buyer, "Mew ex");
  await reviewList(buyer);
  await expect(buyer.getByText("PickMe Flash in Colombo")).toBeVisible();
  await fillForm(buyer);
  await buyer.getByRole("button", { name: "Send to seller" }).click();
  await expect(buyer.getByText("Choose delivery or pickup.")).toBeVisible();
  await expect(buyer.getByText("Choose how you'll pay.")).toBeVisible();
  await buyer.getByText("Delivery", { exact: true }).click();
  await buyer.getByText("Bank transfer", { exact: true }).click();
  await buyer.getByRole("button", { name: "Send to seller" }).click();
  await expect(buyer.locator("#phone-error")).toBeVisible();
  await expect(buyer.locator("#address-error")).toBeVisible();
  await buyer.getByLabel("Delivery address").fill("12 Galle Rd, Colombo 3");
  await buyer.getByLabel("Phone").fill("077 123 4567");
  await buyer.getByRole("button", { name: "Send to seller" }).click();
  await sent(buyer);
  const code = (await buyer.getByTestId("request-code").textContent())!;
  await expect(buyer.getByText("Delivery · Bank transfer")).toBeVisible();
  await expect(buyer.getByTestId("bank-details")).toHaveText(BANK);
  await expect(buyer.getByText(`Use ${code} as the reference.`)).toBeVisible();

  // The seller sees where to send it and who to call, with transfer picked.
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Review sale" }).first().click();
  const how = page.getByRole("region", { name: "Delivery and payment" });
  await expect(how).toContainText("Delivery · Bank transfer");
  await expect(how).toContainText("12 Galle Rd, Colombo 3");
  await expect(how.getByRole("link", { name: "077 123 4567" })).toHaveAttribute(
    "href",
    "tel:0771234567",
  );
  await expect(page.getByRole("radio", { name: "Transfer" })).toBeChecked();
  await confirm(page).click();
  await expect(page.getByTestId("receipt-no")).toBeVisible();
});

test("a pickup and cash buyer sees no bank details, and a table store asks nothing", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  await saveSettings(page, { mode: "Online store" });
  const online = page.getByRole("group", { name: "Online orders" });
  await online.getByLabel(/^Pickup/).check();
  await online.getByLabel(/^Cash on delivery/).check();
  await online.getByLabel(/^Bank transfer/).check();
  await page.getByLabel("Bank details").fill(BANK);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved.", { exact: true })).toBeVisible();

  const buyer = await newBuyer(browser, slug);
  await add(buyer, "Mew ex");
  await reviewList(buyer);
  // One way to get it is a fact, not a question.
  await expect(buyer.getByText("Pickup only")).toBeVisible();
  await fillForm(buyer);
  await buyer.getByText("Cash at pickup", { exact: true }).click();
  await buyer.getByRole("button", { name: "Send to seller" }).click();
  await sent(buyer);
  await expect(buyer.getByText("Pickup · Cash at pickup")).toBeVisible();
  await expect(buyer.getByTestId("bank-details")).toHaveCount(0);

  // Back at a table, the same store's cart asks none of it.
  await saveSettings(page, { mode: "At a table" });
  const walkIn = await newBuyer(browser, slug);
  await add(walkIn, "Umbreon VMAX");
  await reviewList(walkIn);
  await expect(walkIn.getByText("Pickup only")).toHaveCount(0);
  await expect(walkIn.getByText("How will you pay?")).toHaveCount(0);
});
