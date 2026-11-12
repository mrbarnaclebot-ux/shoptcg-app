import { expect, type Browser, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { OUTBOX } from "../playwright.config";
import { parseCsv } from "../src/lib/csv";
import { newVendor } from "./auth";

/** A signed-in vendor with demo stock and an open store. */
export async function openVendor(page: Page) {
  const id = await newVendor(page);
  const res = await page.request.post("/api/e2e/seed");
  expect(res.ok()).toBe(true);
  await page.goto("/dashboard");
  await setStore(page, "open");
  return `e2e-${id}`;
}

export type StoreTo =
  "open" | "off" | { pause: "15 min" | "1 hour" | "Until I reopen" };

/** Sets the store from the dashboard control and waits for the save to land. */
export async function setStore(page: Page, to: StoreTo) {
  const control = page.getByRole("region", { name: "Your store" });
  const button = (name: string) =>
    control.getByRole("button", { name, exact: true });
  if (to === "open") await button("Open store").click();
  else if (to === "off") {
    await button("Not vending").click();
    await button("Stop vending").click();
  } else {
    await button("Pause").click();
    await control
      .getByRole("group", { name: "Pause for" })
      .getByRole("button", { name: to.pause })
      .click();
  }
  const state = to === "open" ? "open" : to === "off" ? "off" : "paused";
  await expect(control).toHaveAttribute("data-state", state);
  // It changes before the save lands; a buyer loading now could see the old state.
  await expect(control).toHaveAttribute("aria-busy", "false", {
    timeout: 10_000,
  });
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

/** One figure on the report, by its label. */
export const reportRow = (page: Page, label: string) =>
  page
    .locator("dl > div")
    .filter({ has: page.getByText(label, { exact: true }) });

/** Clicks an export and returns the file's rows without the header. */
export async function exported(page: Page, name: string) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name }).click(),
  ]);
  const text = await readFile(await download.path(), "utf8");
  expect(text.startsWith("﻿")).toBe(true);
  const rows = parseCsv(text).map((r) => r.cells);
  await expect(
    page.getByRole("status").getByText(download.suggestedFilename()).first(),
  ).toBeVisible();
  return {
    file: download.suggestedFilename(),
    head: rows[0],
    rows: rows.slice(1),
  };
}
