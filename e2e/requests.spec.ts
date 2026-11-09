import { expect, test } from "@playwright/test";
import { newVendor } from "./auth";
import {
  add,
  fillForm,
  newBuyer,
  openVendor,
  reviewList,
  sendList,
  sent,
} from "./buyer";

test("happy path: the seller sees the ticket within 3 seconds", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  await expect(page.getByText("Live", { exact: true })).toBeVisible();
  const buyer = await newBuyer(browser, slug);
  const code = await sendList(buyer, slug, ["Charizard ex", "Gengar"]);
  await expect(buyer.getByTestId("hold-clock")).toHaveText(/\d+:\d\d/);
  await expect(buyer.getByText("Show the seller this code")).toBeVisible();

  await expect(page.getByText(code, { exact: true })).toBeVisible({
    timeout: 3000,
  });
  await expect(page.getByText("Maya Robinson")).toBeVisible();
  await expect(page.locator(".toasts").getByText("New request")).toBeVisible();
  await expect(page).toHaveTitle("(1) Requests");
  // The email stays on the server: not in the seller's page or its payload.
  expect(await page.content()).not.toContain("maya@example.test");

  // Sending empties the list.
  await buyer.goto(`/${slug}`);
  await expect(buyer.getByRole("link", { name: "Review list" })).toHaveCount(0);
});

test("the last copy: others see it on hold, a stale list can send without it", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  const late = await newBuyer(browser, slug);
  await add(late, "Mew ex");
  await add(late, "Gengar");
  await reviewList(late);
  await fillForm(late, "Late Buyer");

  const first = await newBuyer(browser, slug);
  await sendList(first, slug, ["Mew ex"]);

  // The stale review page finds out on send.
  await late.getByRole("button", { name: "Send to seller" }).click();
  await expect(late.getByText("Just taken by another buyer")).toBeVisible();
  const without = late.getByRole("button", { name: "Send without it" });
  await expect(without).toBeVisible();

  const third = await newBuyer(browser, slug);
  const tile = third.locator("article").filter({ hasText: "Mew ex" });
  await expect(tile).toContainText("On hold");
  await expect(
    third.getByRole("button", { name: "Add Mew ex to your list" }),
  ).toHaveCount(0);

  await without.click();
  await sent(late);
  // Roles skip the store page Next keeps hidden behind this one.
  const line = (name: string) =>
    late.getByRole("listitem").filter({ hasText: name });
  await expect(line("Gengar")).toBeVisible();
  await expect(line("Mew ex")).toHaveCount(0);
});

test("decline releases the stock and tells the buyer", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  const buyer = await newBuyer(browser, slug);
  const code = await sendList(buyer, slug, ["Mew ex"]);
  await expect(page.getByText(code, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Decline" }).click();
  await expect(page.getByText("Decline and release items?")).toBeVisible();
  await page.getByRole("button", { name: "Decline" }).click();
  await expect(page.getByText(code, { exact: true })).toHaveCount(0);

  await expect(
    buyer.getByRole("heading", { name: "The seller couldn't do this one." }),
  ).toBeVisible();
  await buyer.goto(`/${slug}`);
  await expect(
    buyer.getByRole("button", { name: "Add Mew ex to your list" }),
  ).toBeVisible();
});

test("a buyer cancels and the seller's ticket goes away", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  const buyer = await newBuyer(browser, slug);
  const code = await sendList(buyer, slug, ["Mew ex"]);
  await expect(page.getByText(code, { exact: true })).toBeVisible();

  await buyer.getByRole("button", { name: "Cancel request" }).click();
  await buyer.getByRole("button", { name: "Yes, cancel" }).click();
  await expect(
    buyer.getByRole("heading", { name: "Request cancelled." }),
  ).toBeVisible();
  await expect(page.getByText(code, { exact: true })).toHaveCount(0);

  await buyer.goto(`/${slug}`);
  await expect(
    buyer.getByRole("button", { name: "Add Mew ex to your list" }),
  ).toBeVisible();
});

test("a hold lapses: the buyer can send again, the seller's group counts it", async ({
  page,
  browser,
  baseURL,
}) => {
  const slug = await openVendor(page);
  const ctx = await browser.newContext();
  await ctx.addCookies([{ name: "e2e_hold_ms", value: "3000", url: baseURL! }]);
  const buyer = await ctx.newPage();
  await sendList(buyer, slug, ["Mew ex"]);

  await expect(
    buyer.getByRole("heading", { name: "Your hold ended." }),
  ).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Expired today (1)")).toBeVisible({
    timeout: 10_000,
  });

  await buyer
    .locator("main")
    .getByRole("button", { name: "Send again" })
    .click();
  await expect(buyer.getByRole("heading", { name: "Your list" })).toBeVisible();
  await expect(
    buyer.getByRole("listitem").filter({ hasText: "Mew ex" }),
  ).toBeVisible();
});

test("bad fields show inline errors and focus the name", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  const buyer = await newBuyer(browser, slug);
  await add(buyer, "Gengar");
  await reviewList(buyer);
  await buyer.getByLabel("Email for your receipt").fill("not-an-email");
  await buyer.getByRole("button", { name: "Send to seller" }).click();
  await expect(buyer.getByText("Enter your name.")).toBeVisible();
  await expect(
    buyer.getByText("Enter an email like name@example.com."),
  ).toBeVisible();
  await expect(buyer.getByLabel("Your name")).toBeFocused();
});

test("the fourth send in ten minutes is refused", async ({ page, browser }) => {
  const slug = await openVendor(page);
  const buyer = await newBuyer(browser, slug);
  // Cancelling keeps the "2 pending" limit out of the way of the per-phone one.
  for (let i = 0; i < 3; i++) {
    await sendList(buyer, slug, ["Gengar"]);
    await buyer.getByRole("button", { name: "Cancel request" }).click();
    await buyer.getByRole("button", { name: "Yes, cancel" }).click();
    await expect(
      buyer.getByRole("heading", { name: "Request cancelled." }),
    ).toBeVisible();
  }
  await buyer.goto(`/${slug}`);
  await add(buyer, "Gengar");
  await reviewList(buyer);
  await fillForm(buyer);
  await buyer.getByRole("button", { name: "Send to seller" }).click();
  await expect(
    buyer.getByText("Too many requests from this phone."),
  ).toBeVisible();
});

test("strangers: another phone gets a 404, another vendor can't decline", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  const owner = await newBuyer(browser, slug);
  const code = await sendList(owner, slug, ["Mew ex"]);
  const url = owner.url();
  const id = url.split("/").pop()!;

  const stranger = await newBuyer(browser, slug);
  expect((await stranger.goto(url))!.status()).toBe(404);
  const stream = await stranger.request.get(`/api/live/request/${id}`);
  expect(stream.status()).toBe(404);

  // A second vendor declines their own ticket, with the first store's id
  // swapped into the server action call on the wire.
  const rival = await (await browser.newContext()).newPage();
  await newVendor(rival);
  await rival.request.post("/api/e2e/seed");
  await rival.goto("/dashboard");
  await rival.getByRole("button", { name: "Send a test request" }).click();
  await rival.getByRole("button", { name: "Decline" }).click();
  await rival.route("**/dashboard", (route) => {
    const body = route.request().postData();
    if (route.request().method() !== "POST" || !body) return route.continue();
    return route.continue({
      postData: body.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/, id),
    });
  });
  await rival.getByRole("button", { name: "Decline" }).click();
  await expect(
    rival.locator(".toasts").getByText("That request is no longer open."),
  ).toBeVisible();

  await owner.reload();
  await expect(owner.getByTestId("request-code")).toHaveText(code);
  await expect(page.getByText(code, { exact: true })).toBeVisible();
});

test("a closed store: no list bar, and a stale list gets the closed copy", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  const buyer = await newBuyer(browser, slug);
  await add(buyer, "Gengar");
  await reviewList(buyer);
  await fillForm(buyer);

  const open = page.getByRole("switch", { name: "Store open" });
  await open.click();
  await expect(open).toHaveAttribute("aria-checked", "false");
  await expect(open).toHaveAttribute("aria-busy", "false");

  await buyer.getByRole("button", { name: "Send to seller" }).click();
  await expect(
    buyer.getByText(/just closed\. Your list is saved/),
  ).toBeVisible();

  await buyer.goto(`/${slug}`);
  await expect(buyer.getByText("Browsing only.")).toBeVisible();
  await expect(buyer.getByRole("link", { name: "Review list" })).toHaveCount(0);
});

test("a test request lands on the seller's own queue, flagged", async ({
  page,
}) => {
  await openVendor(page);
  await page.getByRole("button", { name: "Send a test request" }).click();
  await expect(page.getByText("Test buyer")).toBeVisible();
  await expect(page.getByText("Test", { exact: true })).toBeVisible();
});

test("Terms name buyer requests; the app installs", async ({
  page,
  request,
}) => {
  await page.goto("/terms");
  await expect(
    page.getByRole("heading", { name: "Buyer requests" }),
  ).toBeVisible();
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.start_url).toBe("/dashboard");
  for (const icon of manifest.icons) {
    const res = await request.get(icon.src);
    expect(res.headers()["content-type"]).toBe("image/png");
  }
  expect((await request.get("/apple-icon")).ok()).toBe(true);
  expect((await request.get("/sw.js")).ok()).toBe(true);
});
