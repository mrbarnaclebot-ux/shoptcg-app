import { readFile } from "node:fs/promises";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { parseCsv } from "../src/lib/csv";
import {
  buyerEmail,
  confirm,
  openVendor,
  outboxLine,
  pay,
  reviewSale,
} from "./buyer";
import { addPastSale, hasDb } from "./db";

type Sale = {
  item: string;
  price: string;
  method: string;
  pct?: string;
  email?: string;
  promo?: boolean;
  name?: string;
};

async function sell(page: Page, browser: Browser, slug: string, s: Sale) {
  await reviewSale(page, browser, slug, [s.item], s);
  await page.getByLabel(`Price each for ${s.item}`).fill(s.price);
  if (s.pct) {
    await page.getByText("%", { exact: true }).click();
    await page.getByLabel("Percent off").fill(s.pct);
  }
  await pay(page, s.method);
  await confirm(page).click();
  await expect(page.getByTestId("receipt-no")).toBeVisible();
}

const row = (page: Page, label: string) =>
  page
    .locator("dl > div")
    .filter({ has: page.getByText(label, { exact: true }) });

/** Clicks an export and returns the file's rows without the header. */
async function exported(page: Page, name: string) {
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

test("a show's report adds up, and its CSV is safe to open", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const slug = await openVendor(page);
  await sell(page, browser, slug, {
    item: "Charizard ex",
    price: "100",
    method: "Cash",
    pct: "10",
    name: "=cmd|' /C calc'!A0 Robinson",
  });
  await sell(page, browser, slug, {
    item: "Pikachu",
    price: "40",
    method: "Cash",
  });
  await sell(page, browser, slug, {
    item: "Gengar",
    price: "10",
    method: "Card",
  });

  await page.goto("/dashboard/sales");
  await page.getByRole("link", { name: "Report" }).click();
  await expect(page.getByRole("link", { name: "Today" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(row(page, "Revenue")).toContainText("$140.00");
  await expect(row(page, "Sales")).toContainText("3");
  await expect(row(page, "Items sold")).toContainText("3");
  await expect(row(page, "Average sale")).toContainText("$46.67");
  await expect(row(page, "Discounts given")).toContainText("$10.00");
  const pays = page.getByRole("table");
  await expect(pays.getByRole("row").nth(1)).toContainText("Cash");
  await expect(pays.getByRole("row").nth(1)).toContainText("$130.00");
  await expect(pays.getByRole("row", { name: "Card" })).toContainText("$10.00");
  await expect(pays.getByRole("row", { name: "Transfer" })).toContainText(
    "$0.00",
  );
  await expect(page.getByText("Count your cash box")).toBeVisible();
  // Best sellers: before discounts, and the language shows.
  const best = page
    .getByRole("heading", { name: "Best sellers" })
    .locator("..");
  await expect(best.getByRole("listitem").first()).toContainText(
    "Charizard ex",
  );
  await expect(best.getByRole("listitem").first()).toContainText("$100.00");
  await expect(best.getByRole("listitem").nth(1)).toContainText("JP");

  // A row opens with no JS and links to its receipt.
  await page.locator("summary", { hasText: "R-0001." }).click();
  await page.getByRole("link", { name: "Open receipt R-0001" }).click();
  await expect(page.getByTestId("receipt-no")).toHaveText("R-0001");
  await page.goto("/dashboard/reports");

  const { file, head, rows } = await exported(page, "Export CSV");
  expect(file).toMatch(
    new RegExp(`^shoptcg-${slug}-\\d{4}-\\d\\d-\\d\\d\\.csv$`),
  );
  expect(head.slice(0, 5)).toEqual([
    "date",
    "time",
    "receipt_no",
    "buyer_first_name",
    "item",
  ]);
  expect(rows).toHaveLength(3);
  const first = rows.find((r) => r[2] === "R-0001")!;
  expect(first[3]).toBe("'=cmd|'");
  expect(first.at(-2)).toBe("90.00");
  expect(rows.find((r) => r[2] === "R-0002")![8]).toBe("JP");
  expect(rows.flat().join()).not.toContain("@example.test");
  const res = await page.request.get("/dashboard/reports/export");
  expect(res.headers()["x-row-count"]).toBe("3");
  expect(res.headers()["cache-control"]).toContain("no-store");

  // An empty range, through the native date form.
  await page.getByLabel("From").fill("2021-03-01");
  await page.getByLabel("To").fill("2021-03-02");
  await page.getByRole("button", { name: "Show these days" }).click();
  await expect(page.getByText("No sales in this range.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Export CSV" })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: /^Mar 1 to Mar 2, 2021/ }),
  ).toBeVisible();
});

test("last week's sale is out of today and in a range that covers it", async ({
  page,
}) => {
  test.skip(!hasDb, "needs DATABASE_URL");
  const slug = await openVendor(page);
  const day = await addPastSale(slug, "25.00");
  await page.goto("/dashboard/reports");
  await expect(page.getByText("No sales in this range.")).toBeVisible();
  await page.goto(`/dashboard/reports?from=${day}&to=${day}`);
  await expect(row(page, "Revenue")).toContainText("$25.00");
  await expect(page.getByRole("link", { name: "Today" })).not.toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("the promo list is opted-in buyers only, and unsubscribing leaves it", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const slug = await openVendor(page);
  await page.goto("/dashboard/customers");
  await expect(page.getByText("No customers yet.")).toBeVisible();
  await expect(page.getByText("No one has opted in yet.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Export promo list" }),
  ).toBeDisabled();

  const yes = buyerEmail();
  const gone = buyerEmail();
  const no = buyerEmail();
  for (const [email, promo, name] of [
    [yes, true, "Yara Yes"],
    [gone, true, "Gia Gone"],
    [no, false, "Noor No"],
  ] as const)
    await sell(page, browser, slug, {
      item: "Pikachu",
      price: "1",
      method: "Cash",
      email,
      promo,
      name,
    });

  await page.goto("/dashboard/settings");
  await page.getByRole("link", { name: "Customers" }).click();
  const rowOf = (name: string) =>
    page.getByRole("listitem").filter({ hasText: name });
  await expect(rowOf("Yara Yes")).toContainText("Subscribed since");
  await expect(rowOf("Noor No")).toContainText("Receipts only");
  await expect(rowOf("Noor No")).toContainText("1 purchase.");

  const before = await exported(page, "Export promo list");
  expect(before.file).toMatch(new RegExp(`^shoptcg-${slug}-promo-list-`));
  expect(before.head).toEqual([
    "name",
    "email",
    "subscribed_at",
    "unsubscribe_url",
  ]);
  expect(before.rows.map((r) => r[1]).sort()).toEqual([yes, gone].sort());

  // The link in the export is the one that works.
  const link = before.rows.find((r) => r[1] === gone)![3];
  expect((await outboxLine(gone)).split(" ")[2]).toBe(link);
  const reader = await (await browser.newContext()).newPage();
  await reader.goto(link);
  await reader.getByRole("button", { name: "Unsubscribe" }).click();
  await expect(
    reader.getByRole("heading", { name: /^You're off/ }),
  ).toBeVisible();

  await page.reload();
  await expect(rowOf("Gia Gone")).toContainText("Unsubscribed");
  const after = await exported(page, "Export promo list");
  expect(after.rows.map((r) => r[1])).toEqual([yes]);

  await page.getByRole("link", { name: "Subscribed" }).click();
  await expect(rowOf("Yara Yes")).toBeVisible();
  await expect(rowOf("Noor No")).toHaveCount(0);
  await page.getByRole("link", { name: "All" }).click();
  await page.getByLabel("Search by name or email").fill("noor");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(rowOf("Noor No")).toBeVisible();
  await expect(rowOf("Yara Yes")).toHaveCount(0);

  await page.getByRole("button", { name: "Remove Noor No" }).click();
  await page.getByRole("button", { name: "Keep" }).click();
  await page.getByRole("button", { name: "Remove Noor No" }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByText("No one matches that.")).toBeVisible();
});

test("another vendor's export has none of this vendor's sales", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  await sell(page, browser, slug, {
    item: "Gengar",
    price: "1",
    method: "Cash",
    promo: true,
    email: buyerEmail(),
  });
  const other = await (await browser.newContext()).newPage();
  await openVendor(other);
  for (const path of [
    "/dashboard/reports/export",
    "/dashboard/customers/export",
  ]) {
    const res = await other.request.get(path);
    expect(res.headers()["x-row-count"]).toBe("0");
    expect(await res.text()).not.toContain("R-0001");
  }
});

test("an export needs a real session", async ({ browser, baseURL }) => {
  const anon = await browser.newContext();
  const noCookie = await anon.request.get("/dashboard/reports/export", {
    maxRedirects: 0,
  });
  expect(noCookie.status()).toBe(307);
  expect(noCookie.headers().location).toContain("/login");
  const forged = await browser.newContext();
  await forged.addCookies([
    { name: "better-auth.session_token", value: "forged", url: baseURL! },
  ]);
  for (const path of [
    "/dashboard/reports/export",
    "/dashboard/customers/export",
  ]) {
    const res = await forged.request.get(path, { maxRedirects: 0 });
    expect(res.status()).toBe(401);
  }
});
