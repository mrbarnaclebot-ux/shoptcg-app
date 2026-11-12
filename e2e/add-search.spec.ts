import { expect, test, type Page } from "@playwright/test";
import { newVendor } from "./auth";

// E2E builds search the fake provider in src/lib/pricing/e2e.ts, never TCGdex
// or PPT. The seed route's cards are the catalog cache.

async function setUp(page: Page) {
  await newVendor(page);
  expect((await page.request.post("/api/e2e/seed")).ok()).toBe(true);
  await page.goto("/dashboard/inventory/add");
  return page.getByLabel("Search the catalog");
}

const result = (page: Page, name: RegExp) =>
  page.getByRole("list").getByRole("button", { name });

test("cached cards show at once, then the provider's are merged in", async ({
  page,
}) => {
  const box = await setUp(page);
  await box.fill("charizard");
  // The seeded card, with its market price, before the provider answers.
  const seeded = result(page, /^Charizard ex 151 #199/);
  await expect(seeded).toContainText("$295.00");
  await expect(page.getByText("Looking up more cards")).toBeVisible();
  await expect(result(page, /^Charizard Base Set #4/)).toBeVisible();
  await expect(result(page, /Obsidian Flames/)).toBeVisible();
  // The provider also returned the seeded card: it shows once.
  await expect(seeded).toHaveCount(1);
  await expect(page.getByText(/^3 cards\./)).toBeVisible();

  // Word order and set names: the cached Mew ex and the provider's Mew.
  await box.fill("151 mew");
  await expect(result(page, /^Mew ex 151 #205/)).toBeVisible();
  await expect(result(page, /^Mew 151 #151/)).toBeVisible();

  // Enter picks the top result: the exact number match.
  await box.fill("base set charizard 4");
  await expect(result(page, /^Charizard Base Set #4/)).toBeVisible();
  await expect(page.getByText(/^1 card\./)).toBeVisible();
  await box.press("Enter");
  await expect(page.getByRole("heading", { name: "Charizard" })).toBeVisible();
  await page.getByRole("button", { name: "Add to stock" }).click();
  await expect(page.getByText("Added Charizard to your stock.")).toBeVisible();
});

test("search says why the provider couldn't help", async ({
  page,
  context,
}) => {
  const box = await setUp(page);
  await box.fill("zzqx");
  await expect(page.getByText("No cards found.")).toBeVisible();
  await box.fill("busy");
  await expect(page.getByText("Card lookup is busy right now")).toBeVisible();
  await box.fill("down");
  await expect(page.getByText("Card lookup isn't answering")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await context.setOffline(true);
  await box.fill("mew offline");
  await expect(page.getByText("You're offline.")).toBeVisible();
  await context.setOffline(false);
});

test("type and language stick, and a graded pick asks for the grade", async ({
  page,
}) => {
  const box = await setUp(page);
  await page.getByText("Graded", { exact: true }).click();
  await page.getByText("JP", { exact: true }).click();
  await page.reload();
  await expect(page.getByRole("radio", { name: "Graded" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "JP" })).toBeChecked();

  // A graded search lists raw cards; the grade is picked when adding.
  await page.getByText("EN", { exact: true }).click();
  await box.fill("mew 205");
  await result(page, /^Mew ex/).click();
  await expect(page.getByRole("radio", { name: "PSA" })).toBeChecked();
  await page.getByLabel("Grade", { exact: true }).selectOption("9");
  await page.getByRole("button", { name: "Add to stock" }).click();
  await expect(page.getByText("Added Mew ex to your stock.")).toBeVisible();
});
