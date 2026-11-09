import { expect, type Browser, type Page } from "@playwright/test";
import { newVendor } from "./auth";

/** A signed-in vendor with demo stock and an open store. */
export async function openVendor(page: Page) {
  const id = await newVendor(page);
  const res = await page.request.post("/api/e2e/seed");
  expect(res.ok()).toBe(true);
  await page.goto("/dashboard");
  const open = page.getByRole("switch", { name: "Store open" });
  await open.click();
  await expect(open).toHaveAttribute("aria-checked", "true");
  return `e2e-${id}`;
}

export async function newBuyer(browser: Browser, slug: string) {
  const buyer = await (await browser.newContext()).newPage();
  await buyer.goto(`/${slug}`);
  return buyer;
}

export const add = (buyer: Page, name: string) =>
  buyer.getByRole("button", { name: `Add ${name} to your list` }).click();

export async function reviewList(buyer: Page) {
  await buyer.getByRole("link", { name: "Review list" }).click();
  await expect(buyer.getByRole("heading", { name: "Your list" })).toBeVisible();
}

export async function fillForm(
  buyer: Page,
  name = "Maya Robinson",
  email = "maya@example.test",
) {
  await buyer.getByLabel("Your name").fill(name);
  await buyer.getByLabel("Email for your receipt").fill(email);
}

export const sent = (buyer: Page) =>
  expect(buyer.getByRole("heading", { name: /^Sent to/ })).toBeVisible();

/** Add, review and send; ends on the waiting screen and returns the code. */
export async function sendList(
  buyer: Page,
  slug: string,
  items: string[],
  opts: { email?: string; promo?: boolean } = {},
) {
  await buyer.goto(`/${slug}`);
  for (const item of items) await add(buyer, item);
  await reviewList(buyer);
  await fillForm(buyer, undefined, opts.email);
  if (opts.promo) await buyer.getByLabel(/^Email me when/).check();
  await buyer.getByRole("button", { name: "Send to seller" }).click();
  await sent(buyer);
  return (await buyer.getByTestId("request-code").textContent())!;
}
