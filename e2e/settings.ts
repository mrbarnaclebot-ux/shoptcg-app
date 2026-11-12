import { expect, type Page } from "@playwright/test";

type Settings = {
  rule?: string;
  rounding?: string;
  currency?: [code: string, rate: string];
  table?: string;
  nfc?: boolean;
  mode?: "At a table" | "Online store";
};

const save = async (page: Page) => {
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved.", { exact: true })).toBeVisible();
};

/** Saves store settings on the pages they live on, and ends on the last one. */
export async function saveSettings(page: Page, set: Settings) {
  if (set.rule !== undefined || set.rounding || set.currency) {
    await page.goto("/dashboard/settings/pricing");
    if (set.rule !== undefined)
      await page.getByLabel("Price rule (% of market)").fill(set.rule);
    if (set.rounding) await page.getByText(set.rounding).click();
    if (set.currency) {
      await page.getByLabel("Code").fill(set.currency[0]);
      await page.getByLabel("Your rate for 1 USD").fill(set.currency[1]);
    }
    await save(page);
  }
  if (set.table !== undefined || set.nfc !== undefined || set.mode) {
    await page.goto("/dashboard/settings/table");
    if (set.mode) await page.getByText(set.mode, { exact: true }).click();
    if (set.table !== undefined)
      await page.getByLabel("Table number").fill(set.table);
    if (set.nfc !== undefined)
      await page
        .getByLabel("I have an NFC tag on my table")
        .setChecked(set.nfc);
    await save(page);
  }
}
