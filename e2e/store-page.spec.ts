import { expect, test, type Page } from "@playwright/test";
import { newVendor } from "./auth";

type Seeded = { zard: string; thin: string; sold: string; hidden: string };

/** A new vendor with demo stock (env-gated /api/e2e/seed); returns the slug and ids. */
async function seededVendor(page: Page) {
  const id = await newVendor(page);
  const res = await page.request.post("/api/e2e/seed");
  expect(res.ok()).toBe(true);
  return { slug: `e2e-${id}`, ids: (await res.json()) as Seeded };
}

/** Saves the settings form with the given changes. */
async function saveSettings(
  page: Page,
  set: { currency?: [string, string]; nfc?: boolean },
) {
  await page.goto("/dashboard/settings");
  if (set.currency) {
    await page.getByLabel("Code").fill(set.currency[0]);
    await page.getByLabel("Your rate for 1 USD").fill(set.currency[1]);
  }
  if (set.nfc !== undefined)
    await page.getByLabel("I have an NFC tag on my table").setChecked(set.nfc);
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Saved.", { exact: true })).toBeVisible();
}

async function openStore(page: Page) {
  await page.goto("/dashboard");
  const open = page.getByRole("switch", { name: "Store open" });
  await open.click();
  await expect(open).toHaveAttribute("aria-checked", "true");
}

const count = (page: Page) =>
  page.getByRole("region", { name: "Stock" }).locator("article");

test("an unknown store is a real 404", async ({ page, request }) => {
  expect((await request.get("/no-such-store")).status()).toBe(404);
  expect((await request.get("/ab")).status()).toBe(404);
  await page.goto("/no-such-store");
  await expect(
    page.getByRole("heading", { name: "We can't find that store." }),
  ).toBeVisible();
});

test("a buyer browses, filters and opens an item", async ({
  page,
  browser,
}) => {
  const { slug, ids } = await seededVendor(page);
  await openStore(page);
  await saveSettings(page, { currency: ["AUD", "1.52"] });

  // A fresh context: buyers have no cookies.
  const buyer = await (await browser.newContext()).newPage();
  await buyer.goto(`/${slug}`);
  await expect(count(buyer)).toHaveCount(8);
  const zard = buyer.locator("article").filter({ hasText: "Charizard ex" });
  await expect(zard).toContainText("$265.50");
  await expect(zard).toContainText("approx. A$404");
  await expect(zard).toContainText("10% under market");

  // Sold out sorts last and shows no price; hidden stock never appears.
  const last = count(buyer).last();
  await expect(last).toContainText("Sold out");
  await expect(last).not.toContainText("$");
  await expect(buyer.getByText("Mew ex")).toHaveCount(1);

  await buyer.getByRole("link", { name: "Graded", exact: true }).click();
  await expect(buyer).toHaveURL(/type=graded/);
  await expect(count(buyer)).toHaveCount(1);
  await buyer.getByRole("link", { name: "All", exact: true }).click();
  await expect(buyer).not.toHaveURL(/type=/);
  await buyer.getByRole("link", { name: "JP", exact: true }).click();
  await expect(buyer).toHaveURL(/lang=ja/);
  await expect(count(buyer)).toHaveCount(2);

  // Shareable: the same URL in another tab shows the same view.
  const shared = await (await browser.newContext()).newPage();
  await shared.goto(buyer.url());
  await expect(count(shared)).toHaveCount(2);

  await buyer.goto(`/${slug}`);
  await buyer.getByLabel("Search name or number").fill("199");
  await buyer.getByLabel("Search name or number").press("Enter");
  await expect(buyer).toHaveURL(/q=199/);
  await expect(count(buyer)).toHaveCount(1);

  await buyer.goto(`/${slug}/item/${ids.zard}`);
  await expect(
    buyer.getByRole("heading", { name: "Charizard ex" }),
  ).toBeVisible();
  await expect(
    buyer.getByText(/(Up|Down) \d+% in 30 days|Flat over 30 days/),
  ).toBeVisible();
  await buyer.getByRole("link", { name: "90 days" }).click();
  await expect(buyer.getByText(/in 90 days|over 90 days/)).toBeVisible();
  await buyer.goto(`/${slug}/item/${ids.thin}`);
  await expect(
    buyer.getByText("Not enough price history yet.", { exact: false }),
  ).toBeVisible();

  const hidden = await buyer.request.get(`/${slug}/item/${ids.hidden}`);
  expect(hidden.status()).toBe(404);
  expect((await buyer.request.get(`/${slug}/item/nope`)).status()).toBe(404);
});

test("a closed store can be browsed but not requested from", async ({
  page,
  browser,
}) => {
  const { slug } = await seededVendor(page);
  const buyer = await (await browser.newContext()).newPage();
  await buyer.goto(`/${slug}`);
  await expect(buyer.getByText("Browsing only.")).toBeVisible();
  await expect(buyer.getByRole("button", { name: /to your list/ })).toHaveCount(
    0,
  );

  await openStore(page);
  await buyer.reload();
  await expect(buyer.getByText("Browsing only.")).toHaveCount(0);
  await expect(
    buyer.getByRole("button", { name: /to your list/ }).first(),
  ).toBeVisible();
});

test("the buyer's list survives a reload", async ({ page, browser }) => {
  const { slug } = await seededVendor(page);
  await openStore(page);
  const buyer = await (await browser.newContext()).newPage();
  await buyer.goto(`/${slug}`);
  await buyer
    .getByRole("button", { name: "Add Charizard ex to your list" })
    .click();
  await buyer.getByRole("button", { name: "Add Mew ex to your list" }).click();
  await expect(
    buyer.getByRole("status").filter({ hasText: "Your list" }),
  ).toContainText("2 items");
  await buyer.reload();
  await expect(
    buyer.getByRole("status").filter({ hasText: "Your list" }),
  ).toContainText("2 items, $313.60");
});

test("the table sign prints one A5 page with a QR that scans to the store", async ({
  page,
}) => {
  const id = await newVendor(page);
  const slug = `e2e-${id}`;
  await page.goto("/dashboard/sign");
  await expect(page.getByTestId("sign-url")).toHaveText(
    new RegExp(`/${slug}$`),
  );
  await expect(page.locator(".ts-nfc")).toHaveCount(0);

  // Decode in the page: SVG to canvas to jsQR, as a phone camera would.
  await page.addScriptTag({ path: require.resolve("jsqr/dist/jsQR.js") });
  const decoded = await page
    .locator("svg[aria-label^='QR code']")
    .evaluate(async (svg) => {
      const img = new Image();
      const xml = new XMLSerializer().serializeToString(svg);
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = c.height = 400;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0, 400, 400);
      const { data } = ctx.getImageData(0, 0, 400, 400);
      type Decode = (
        d: Uint8ClampedArray,
        w: number,
        h: number,
      ) => { data: string } | null;
      return (window as unknown as { jsQR: Decode }).jsQR(data, 400, 400)?.data;
    });
  expect(decoded).toBe(`${new URL(page.url()).origin}/${slug}?src=sign`);

  await page.getByLabel("Table number").fill("B14");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".ts-table")).toHaveText("TableB14");

  const pdf = await page.pdf({
    preferCSSPageSize: true,
    printBackground: true,
  });
  const pages = pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? [];
  expect(pages).toHaveLength(1);

  await saveSettings(page, { nfc: true });
  await page.goto("/dashboard/sign");
  await expect(page.locator(".ts-nfc")).toBeVisible();
  await expect(page.getByText(`/${slug}?src=nfc`)).toBeVisible();
});
