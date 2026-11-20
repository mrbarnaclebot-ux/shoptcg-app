import { expect, test, type Page } from "@playwright/test";
import { add, fillForm, newBuyer, openVendor, reviewList, sent } from "./buyer";

const CARD = "Charizard ex";

/** The tag on the buyer's own list bar. */
async function tagOf(buyer: Page) {
  const bar = buyer.getByRole("status").filter({ hasText: "Your cart" });
  await expect(bar).toContainText("The seller can see it.");
  return (await bar.textContent())!.match(/Your cart, (\w{3})\./)![1];
}

test("the vendor sees who is on the page and the lists they are building", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  const counts = page.getByTestId("floor-counts");
  await expect(counts).toContainText("0 people on your page now");
  await expect(page.getByText("No open carts.")).toBeVisible();

  const a = await newBuyer(browser, slug);
  await expect(counts).toContainText("1 person on your page now");
  await add(a, CARD);
  const tagA = await tagOf(a);
  const listA = page.locator(`[data-basket="${tagA}"]`);
  await expect(listA).toContainText(CARD);
  await expect(listA).toContainText("1 item");

  // A list holds no stock, so a second buyer can want the same card.
  const b = await newBuyer(browser, slug);
  await add(b, CARD);
  const listB = page.locator(`[data-basket="${await tagOf(b)}"]`);
  await expect(listB).toContainText(CARD);
  await expect(listA).toContainText("Also on 1 other cart");
  await expect(counts).toContainText("2 people on your page now");
  await expect(counts).toContainText("2 people today");

  // The vendor opening their own page is not a visitor.
  const own = await page.context().newPage();
  await own.goto(`/${slug}`);
  await own.waitForLoadState("networkidle");
  await own.close();
  await page.reload();
  await expect(counts).toContainText("2 people today");

  // Sending turns the list into a request; taking the item off clears the other.
  await reviewList(a);
  await fillForm(a);
  await a.getByRole("button", { name: "Send to seller" }).click();
  await sent(a);
  await expect(listA).toHaveCount(0);
  await expect(page.getByText("Maya Robinson")).toBeVisible();
  await b
    .getByRole("button", { name: `Remove ${CARD} from your cart` })
    .click();
  await expect(page.getByText("No open carts.")).toBeVisible();
});

test("the visit endpoint takes only this site's own well-formed pings", async ({
  page,
  browser,
  baseURL,
}) => {
  const slug = await openVendor(page);
  const anon = await (await browser.newContext()).newPage();
  const device = "0123456789abcdef0123456789abcdef";
  const ping = (body: object, origin = baseURL!) =>
    anon.request
      .post("/api/visit", { data: body, headers: { origin } })
      .then((r) => r.status());
  expect(await ping({ slug, device, lines: [] }, "https://evil.example")).toBe(
    403,
  );
  expect(await ping({ slug, device: "me", lines: [] })).toBe(400);
  expect(await ping({ slug, device, lines: [{ id: "x", qty: 1 }] })).toBe(400);
  expect(await ping({ slug: "no-such-store-here", device, lines: [] })).toBe(
    404,
  );
  expect(await ping({ slug, device, lines: [] })).toBe(204);
  await expect(page.getByTestId("floor-counts")).toContainText(
    "1 person today",
  );
});
