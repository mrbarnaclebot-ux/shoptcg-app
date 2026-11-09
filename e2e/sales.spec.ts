import { readFile } from "node:fs/promises";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { OUTBOX } from "../playwright.config";
import { newVendor } from "./auth";
import { newBuyer, openVendor, sendList } from "./buyer";

const buyerEmail = () =>
  `buyer-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.test`;

/** Sends a list and opens it from the seller's queue. */
async function reviewSale(
  page: Page,
  browser: Browser,
  slug: string,
  items: string[],
  opts: { email?: string; promo?: boolean } = {},
) {
  const buyer = await newBuyer(browser, slug);
  await sendList(buyer, slug, items, opts);
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Review sale" }).first().click();
  await expect(page.getByRole("heading", { name: /^Sale for/ })).toBeVisible();
  return buyer;
}

/** Retries because a tap before hydration is dropped; the seller just taps again. */
const pay = (page: Page, method: string) =>
  expect(async () => {
    await page.getByText(method, { exact: true }).click();
    await expect(
      page.getByRole("radio", { name: method, exact: true }),
    ).toBeChecked({ timeout: 500 });
  }).toPass();

const confirm = (page: Page) =>
  page.getByRole("button", { name: /^Confirm sale/ });

async function outboxLine(email: string) {
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

  await expect(page.locator(".toasts")).toContainText("Sale R-0001 recorded");
  await expect(page.getByTestId("receipt-no")).toHaveText("R-0001");
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
  await expect(page.getByText("Remove what's no longer here.")).toBeVisible();

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
  await reviewSale(page, browser, slug, ["Gengar"], { email });
  await pay(page, "Cash");
  await confirm(page).click();
  await expect(page.getByText("Email didn't send.")).toBeVisible();
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

  // An unknown token reads the same, and a junk token is no error.
  await reader.goto("/u/not-a-real-token");
  await expect(
    reader.getByRole("heading", { name: "Stop emails from this seller?" }),
  ).toBeVisible();
  await reader.getByRole("button", { name: "Unsubscribe" }).click();
  await expect(
    reader.getByRole("heading", { name: "You're off this seller's list." }),
  ).toBeVisible();
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
