import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { newVendor } from "./auth";

// No Pinata key in e2e, so the stored image comes back as a data URL
// (src/lib/image-store.ts). Everything before storage is the real path.
const photo = (width: number, height: number, background: string) =>
  sharp({ create: { width, height, channels: 3, background } })
    .jpeg()
    .toBuffer();

const file = async (name: string, buffer: Buffer | Promise<Buffer>) => ({
  name,
  mimeType: "image/jpeg",
  buffer: await buffer,
});

const banner = (page: Page) => page.locator('img[width="1500"]');
const avatar = (page: Page) => page.locator('img[width="1000"]');
const loaded = (img: ReturnType<typeof banner>) =>
  img.evaluate((el: HTMLImageElement) => [el.naturalWidth, el.naturalHeight]);

test("a vendor sets, replaces and removes their store images", async ({
  page,
  browser,
}) => {
  const slug = `e2e-${await newVendor(page)}`;
  await page.goto("/dashboard/settings/store");
  await page
    .getByLabel("Choose banner")
    .setInputFiles(await file("table.jpg", photo(3000, 2000, "#c0572b")));
  await expect(page.getByAltText("Your banner")).toBeVisible();
  await page
    .getByLabel("Choose profile image")
    .setInputFiles(await file("me.jpg", photo(1200, 900, "#2b6cc0")));
  await expect(page.getByAltText("Your profile image")).toBeVisible();

  // A buyer sees both, at the stored sizes.
  const buyer = await (await browser.newContext()).newPage();
  await buyer.goto(`/${slug}`);
  expect(await loaded(banner(buyer))).toEqual([1500, 500]);
  expect(await loaded(avatar(buyer))).toEqual([1000, 1000]);
  const first = await banner(buyer).getAttribute("src");

  await page
    .getByLabel("Replace banner")
    .setInputFiles(await file("new.jpg", photo(1600, 600, "#111111")));
  await expect(page.getByAltText("Your banner")).not.toHaveAttribute(
    "src",
    first!,
  );

  await page.getByRole("button", { name: "Remove banner" }).click();
  await expect(page.getByAltText("Your banner")).toHaveCount(0);
  await page.getByRole("button", { name: "Remove profile image" }).click();
  await expect(page.getByLabel("Choose profile image")).toBeAttached();
  await buyer.reload();
  await expect(banner(buyer)).toHaveCount(0);
  await expect(avatar(buyer)).toHaveCount(0);
});

test("a bad file is refused with the reason, and nothing is saved", async ({
  page,
}) => {
  await newVendor(page);
  await page.goto("/dashboard/settings/store");
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>');
  await page
    .getByLabel("Choose banner")
    .setInputFiles(await file("logo.png", svg));
  const main = page.locator("main");
  await expect(
    main.getByText("Use a JPEG, PNG or WebP image.", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Choose profile image")
    .setInputFiles(await file("tiny.jpg", photo(200, 200, "#fff")));
  await expect(main.getByText(/at least 500 x 500/)).toBeVisible();
  await page.reload();
  await expect(page.getByAltText("Your banner")).toHaveCount(0);
  await expect(page.getByAltText("Your profile image")).toHaveCount(0);
});

test("uploads need a session, the right origin and a known slot", async ({
  page,
  browser,
  baseURL,
}) => {
  const body = await photo(1600, 600, "#c0572b");
  const post = (ctx: Page, kind: string, origin = baseURL!) =>
    ctx.request.post(`/api/store-image?kind=${kind}`, {
      data: body,
      headers: { origin, "content-type": "image/jpeg" },
    });
  const anon = await (await browser.newContext()).newPage();
  expect((await post(anon, "banner")).status()).toBe(401);
  await newVendor(page);
  expect((await post(page, "banner", "https://evil.example")).status()).toBe(
    403,
  );
  expect((await post(page, "logo")).status()).toBe(400);
  const big = await page.request.post("/api/store-image?kind=banner", {
    data: Buffer.alloc(4 * 1024 * 1024 + 1),
    headers: { origin: baseURL! },
  });
  expect(big.status()).toBe(413);
  expect((await post(page, "banner")).status()).toBe(200);
});
