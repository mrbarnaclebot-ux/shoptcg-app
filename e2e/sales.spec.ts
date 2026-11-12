import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { newVendor } from "./auth";
import {
  add,
  buyerEmail,
  confirm,
  fillForm,
  newBuyer,
  openVendor,
  outboxLine,
  pay,
  reviewList,
  reviewSale,
  sendList,
  sent,
} from "./buyer";

test("a full table sale: edit, discount, confirm, receipt, stock, buyer", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  const email = buyerEmail();
  const buyer = await reviewSale(
    page,
    browser,
    slug,
    ["Charizard ex", "Mew ex"],
    { email, promo: true },
  );
  // The seller's code matches the one on the buyer's phone.
  await expect(page.getByTestId("sale-code")).toHaveText(
    (await buyer.getByTestId("request-code").textContent())!,
  );

  await page.getByLabel("Price each for Charizard ex").fill("200");
  await expect(page.getByText("was")).toContainText("$265.50");
  await page.getByText("%", { exact: true }).click();
  await page.getByLabel("Percent off").fill("10");
  await pay(page, "Cash");
  await expect(page.getByText("-$24.81")).toBeVisible();
  await confirm(page).click();

  await expect(page.getByTestId("receipt-no")).toHaveText("R-0001");
  // The receipt says it all, so the toast doesn't sit on top of it.
  await expect(page.locator(".toasts")).not.toContainText("recorded");
  await expect(page.getByText("Paid by Cash")).toBeVisible();
  // The review route stays mounted but hidden, so only look at what shows.
  await expect(
    page.locator("dd:visible", { hasText: "$223.29" }),
  ).toBeVisible();
  await expect(page.getByText(`Emailed to ${email}.`)).toBeVisible();

  await expect(buyer.getByText("Sold. Enjoy your cards!")).toBeVisible({
    timeout: 3000,
  });
  await expect(buyer.getByText("SOLD", { exact: true })).toBeVisible();
  await expect(buyer.getByText("Paid by Cash")).toBeVisible();

  const line = await outboxLine(email);
  expect(line).toMatch(/ receipt:R-0001 https?:\/\/.+\/u\/[\w-]{43}$/);

  // Stock dropped at confirm: 3 Charizard to 2, the only Mew to 0.
  await page.goto("/dashboard/inventory");
  const row = (name: string) =>
    page.locator("main li").filter({ hasText: name }).first();
  await expect(row("Charizard ex").locator("output")).toHaveText("2");
  await expect(row("Mew ex").locator("output")).toHaveText("0");

  // Today's list and the queue line.
  await page.goto("/dashboard/sales");
  await expect(page.getByRole("link", { name: /R-0001/ })).toContainText(
    "$223.29",
  );
  await page.goto("/dashboard");
  await expect(page.getByText("Today: 1 sale, $223.29")).toBeVisible();
  await expect(page.getByRole("link", { name: "Review sale" })).toHaveCount(0);
});

test("a payment tap before the page wakes up still counts", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  await reviewSale(page, browser, slug, ["Gengar"]);
  // Hold back the scripts, so the tap lands on the server's HTML.
  let wake = () => {};
  const asleep = new Promise<void>((resolve) => (wake = resolve));
  await page.route("**/_next/static/**/*.js", async (route) => {
    await asleep;
    await route.continue();
  });
  const load = page.goto(page.url(), { waitUntil: "commit" });
  await pay(page, "Cash");
  wake();
  await load;
  await expect(confirm(page)).toBeEnabled();
  await expect(
    page.getByRole("radio", { name: "Cash", exact: true }),
  ).toBeChecked();
});

test("a price typed before the page wakes up still counts", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  await reviewSale(page, browser, slug, ["Gengar"]);
  let wake = () => {};
  const asleep = new Promise<void>((resolve) => (wake = resolve));
  await page.route("**/_next/static/**/*.js", async (route) => {
    await asleep;
    await route.continue();
  });
  const load = page.goto(page.url(), { waitUntil: "commit" });
  const price = page.getByLabel("Price each for Gengar");
  await price.fill("7");
  wake();
  await load;
  await pay(page, "Cash");
  await expect(price).toHaveValue("7");
  await expect(confirm(page)).toHaveText(/\$7\.00/);
  await expect(page.getByText("was")).toBeVisible();
});

test.describe("a seller in Tokyo", () => {
  test.use({ timezoneId: "Asia/Tokyo" });

  test("sees the receipt in their own zone", async ({ page, browser }) => {
    const slug = await openVendor(page);
    await reviewSale(page, browser, slug, ["Gengar"]);
    await pay(page, "Cash");
    await confirm(page).click();
    await expect(page.getByTestId("receipt-no")).toHaveText("R-0001");
    await expect(page.getByText(/GMT\+9/)).toBeVisible();
  });
});

test("a double tap makes one sale, and the stamp survives reduced motion", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const buyer = await context.newPage();
  await sendList(buyer, slug, ["Gengar"]);
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Review sale" }).click();
  await pay(page, "Card");
  await confirm(page).dblclick();
  await expect(page.getByTestId("receipt-no")).toHaveText("R-0001");
  await page.goto("/dashboard/sales");
  await expect(page.locator("main li")).toHaveCount(1);
  await expect(buyer.getByText("SOLD", { exact: true })).toBeVisible();
});

test("the payment method is required, and Other needs a note", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  await reviewSale(page, browser, slug, ["Gengar"]);
  await expect(confirm(page)).toBeDisabled();
  await expect(page.getByText("Pick how they paid.")).toBeVisible();
  await pay(page, "Other");
  await expect(confirm(page)).toBeDisabled();
  await page.getByLabel("What did they pay with?").fill("Trade + cash");
  await expect(confirm(page)).toBeEnabled();
  await confirm(page).click();
  await expect(page.getByText("Paid by Trade + cash")).toBeVisible();
});

test("a lapsed hold can still sell, until stock is gone", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  // Two lapsed buyers want the only Mew.
  const lapsedBuyer = async () => {
    const context = await browser.newContext();
    await context.addCookies([
      {
        name: "e2e_hold_ms",
        value: "1200",
        domain: "localhost",
        path: "/",
      },
    ]);
    const buyer = await context.newPage();
    await buyer.goto(`/${slug}`);
    await sendList(buyer, slug, ["Mew ex"]);
    await expect(buyer.getByText("Your hold ended.")).toBeVisible();
    return buyer;
  };
  const first = await lapsedBuyer();
  const firstUrl = first.url().split("/").pop()!;
  const second = await lapsedBuyer();
  const secondUrl = second.url().split("/").pop()!;

  await page.goto(`/dashboard/requests/${firstUrl}`);
  await expect(page.getByText("The hold ended, but nothing")).toBeVisible();
  await pay(page, "Cash");
  await confirm(page).click();
  await expect(page.getByTestId("receipt-no")).toHaveText("R-0001");
  // The buyer on the lapsed screen still hears about it.
  await expect(first.getByText("Sold. Enjoy your cards!")).toBeVisible();

  await page.goto(`/dashboard/requests/${secondUrl}`);
  await expect(page.getByText("No longer in stock")).toBeVisible();
  await pay(page, "Cash");
  await expect(confirm(page)).toBeDisabled();
  await expect(
    page.getByText("Decline this request, or wait for stock."),
  ).toBeVisible();

  // A confirmed request goes straight to its receipt.
  await page.goto(`/dashboard/requests/${firstUrl}`);
  await expect(page.getByTestId("receipt-no")).toHaveText("R-0001");
});

test("a failed receipt email keeps the sale and can be resent", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  const email = buyerEmail();
  await page.context().addCookies([
    {
      name: "e2e_mail_fail",
      value: "1",
      domain: "localhost",
      path: "/",
    },
  ]);
  const buyer = await reviewSale(page, browser, slug, ["Gengar"], { email });
  await pay(page, "Cash");
  await confirm(page).click();
  await expect(page.getByText("Email didn't send.")).toBeVisible();
  await expect(buyer.getByText("We couldn't email it.")).toBeVisible();
  await expect(page.getByTestId("receipt-no")).toHaveText("R-0001");
  await page.getByRole("button", { name: "Resend" }).click();
  await expect(page.locator(".toasts")).toContainText("Email didn't send");

  await page.context().clearCookies({ name: "e2e_mail_fail" });
  await page.getByRole("button", { name: "Resend" }).click();
  await expect(page.getByText(`Emailed to ${email}.`)).toBeVisible();
  expect(await outboxLine(email)).toContain("receipt:R-0001 -");
});

test("unsubscribe works from the email's link, and only by pressing the button", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  const email = buyerEmail();
  await reviewSale(page, browser, slug, ["Gengar"], { email, promo: true });
  await pay(page, "Cash");
  await confirm(page).click();
  const url = (await outboxLine(email)).split(" ")[2];

  const reader = await (await browser.newContext()).newPage();
  await reader.goto(url);
  await expect(
    reader.getByRole("heading", { name: /^Stop emails from E2E Cards/ }),
  ).toBeVisible();
  await reader.getByRole("button", { name: "Unsubscribe" }).click();
  await expect(
    reader.getByRole("heading", { name: /^You're off E2E Cards/ }),
  ).toBeVisible();
  await expect(reader.getByText("You'll still get receipts")).toBeVisible();

  // An unknown token never claims it worked, as that buyer may still be subscribed.
  await reader.goto(`/u/${randomBytes(32).toString("base64url")}`);
  await expect(
    reader.getByRole("heading", { name: "This link has expired." }),
  ).toBeVisible();
  await expect(reader.getByRole("button", { name: "Unsubscribe" })).toHaveCount(
    0,
  );
});

test("another vendor can't see a sale or review a request", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  await reviewSale(page, browser, slug, ["Gengar"]);
  const reviewUrl = new URL(page.url()).pathname;
  await pay(page, "Cash");
  await confirm(page).click();
  await expect(page.getByTestId("receipt-no")).toBeVisible();
  const saleUrl = new URL(page.url()).pathname;

  const rival = await (await browser.newContext()).newPage();
  await newVendor(rival);
  for (const url of [saleUrl, reviewUrl]) {
    await rival.goto(url);
    await expect(
      rival.getByRole("heading", { name: "We can't find that." }),
    ).toBeVisible();
    await expect(rival.getByText("Gengar")).toHaveCount(0);
  }
});

test("a test request can be reviewed but never sold", async ({ page }) => {
  await openVendor(page);
  await page.getByRole("button", { name: "Send a test request" }).click();
  await page.getByRole("link", { name: "Review sale" }).click();
  await expect(page.getByText("This is a test request")).toBeVisible();
  await expect(confirm(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Decline request" }).click();
  await page.getByRole("button", { name: "Decline", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("link", { name: "Review sale" })).toHaveCount(0);
});

test("on a phone, new request toasts stay clear of the Confirm sale bar", async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const slug = await openVendor(page);
  const toasts = page.locator(".toasts li").filter({ hasText: "New request" });
  const buyers = [
    ["Ana Reyes", "Charizard ex"],
    ["Ben Carter", "Gengar"],
    ["Cleo Park", "Mew ex"],
  ];
  // Lists filled first, then sent back to back: toasts last 10 seconds.
  const ready = [];
  for (const [name, item] of buyers) {
    const buyer = await newBuyer(browser, slug);
    await add(buyer, item);
    await reviewList(buyer);
    await fillForm(buyer, name, buyerEmail());
    ready.push(buyer);
  }
  for (const [i, buyer] of ready.entries()) {
    await buyer.getByRole("button", { name: "Send to seller" }).click();
    await sent(buyer);
    await expect(toasts).toHaveCount(i + 1);
  }

  await page
    .getByRole("listitem")
    .filter({ hasText: "Ana Reyes" })
    .getByRole("link", { name: "Review sale" })
    .click();
  await expect(page.getByRole("heading", { name: /^Sale for/ })).toBeVisible();
  // The newest two show, at the top; the bar stays uncovered.
  const shown = page.locator(".toasts li:visible");
  await expect(shown).toHaveCount(2);
  const bar = (await page.locator("[data-toast-clear]").boundingBox())!;
  const boxes = await shown.evaluateAll((els) =>
    els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect),
  );
  for (const box of boxes)
    expect(box.bottom <= bar.y || box.top >= bar.y + bar.height).toBe(true);
});
