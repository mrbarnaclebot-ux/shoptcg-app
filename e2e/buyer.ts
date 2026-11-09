import { expect, type Browser, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { OUTBOX } from "../playwright.config";
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
  // It flips before the save lands; a buyer loading now could still see it closed.
  await expect(open).toHaveAttribute("aria-busy", "false");
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
  opts: { email?: string; promo?: boolean; name?: string } = {},
) {
  await buyer.goto(`/${slug}`);
  for (const item of items) await add(buyer, item);
  await reviewList(buyer);
  await fillForm(buyer, opts.name, opts.email);
  if (opts.promo) await buyer.getByLabel(/^Email me when/).check();
  await buyer.getByRole("button", { name: "Send to seller" }).click();
  await sent(buyer);
  return (await buyer.getByTestId("request-code").textContent())!;
}

export const buyerEmail = () =>
  `buyer-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.test`;

/** Sends a list and opens it from the seller's queue. */
export async function reviewSale(
  page: Page,
  browser: Browser,
  slug: string,
  items: string[],
  opts: { email?: string; promo?: boolean; name?: string } = {},
) {
  const buyer = await newBuyer(browser, slug);
  await sendList(buyer, slug, items, opts);
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Review sale" }).first().click();
  await expect(page.getByRole("heading", { name: /^Sale for/ })).toBeVisible();
  return buyer;
}

/** One tap, no retry: a tap before hydration has to count. */
export const pay = async (page: Page, method: string) => {
  await page.getByText(method, { exact: true }).click();
  await expect(
    page.getByRole("radio", { name: method, exact: true }),
  ).toBeChecked();
};

export const confirm = (page: Page) =>
  page.getByRole("button", { name: /^Confirm sale/ });

export async function outboxLine(email: string) {
  let line: string | undefined;
  await expect
    .poll(async () => {
      const text = await readFile(OUTBOX, "utf8").catch(() => "");
      line = text
        .split("\n")
        .findLast((l) => l.startsWith(`${email} receipt:`));
      return line;
    })
    .toBeTruthy();
  return line!;
}
