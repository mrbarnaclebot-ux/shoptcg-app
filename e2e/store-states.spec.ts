import { expect, test } from "@playwright/test";
import { add, newBuyer, openVendor, sendList, sent, setStore } from "./buyer";

const status = (page: import("@playwright/test").Page) =>
  page.locator("header").getByText(/^(Open|Paused|Not vending)$/);

test("a timed pause reopens by itself, and the buyer's page follows without a reload", async ({
  page,
  browser,
  baseURL,
}) => {
  const slug = await openVendor(page);
  // 15 min becomes 3 s in e2e builds only (seedAllowed).
  await page
    .context()
    .addCookies([{ name: "e2e_pause_ms", value: "3000", url: baseURL! }]);
  const buyer = await newBuyer(browser, slug);
  await expect(status(buyer)).toHaveText("Open");

  await setStore(page, { pause: "15 min" });
  await expect(
    page.getByRole("region", { name: "Your store" }).getByRole("status"),
  ).toHaveText(/Opens again in 1 min/);
  await buyer.reload();
  await expect(status(buyer)).toHaveText("Paused");
  await expect(buyer.getByText("Browsing only.")).toBeVisible();
  await expect(buyer.getByText(/Back in about 1 min/)).toBeVisible();
  await expect(
    buyer.getByRole("button", { name: "Add Mew ex to your list" }),
  ).toHaveCount(0);

  // The page's own timer re-reads it once the pause ends.
  await expect(status(buyer)).toHaveText("Open", { timeout: 10_000 });
  await add(buyer, "Mew ex");
  await expect(buyer.getByRole("link", { name: "Review list" })).toBeVisible();
});

test("not vending shows who and where, no stock, prices or item details", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  const buyer = await newBuyer(browser, slug);
  await buyer
    .getByRole("link", { name: /Mew ex/ })
    .first()
    .click();
  await expect(buyer).toHaveURL(/\/item\//);
  const itemUrl = buyer.url();

  await setStore(page, "off");
  await expect(
    page.locator(".toasts").getByText("Your page shows your name and table"),
  ).toBeVisible();

  // The table sign's QR link still lands on a real page.
  const res = await buyer.goto(`/${slug}?src=sign`);
  expect(res?.status()).toBe(200);
  await expect(status(buyer)).toHaveText("Not vending");
  await expect(buyer.getByText(/isn't vending right now/)).toBeVisible();
  await expect(buyer.getByRole("region", { name: "Stock" })).toHaveCount(0);
  await expect(buyer.getByText(/\$\d/)).toHaveCount(0);
  await expect(buyer.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );

  const item = await buyer.goto(itemUrl);
  expect(item?.status()).toBe(200);
  await expect(buyer.getByText(/isn't vending right now/)).toBeVisible();
  await expect(buyer.getByText(/\$\d/)).toHaveCount(0);
  await expect(
    buyer.getByRole("heading", { name: "Price history" }),
  ).toHaveCount(0);

  await buyer.goto(`/${slug}/list`);
  await expect(buyer.getByText(/isn't vending right now/)).toBeVisible();
  await expect(
    buyer.getByRole("button", { name: "Send to seller" }),
  ).toHaveCount(0);

  // One tap brings it back.
  await setStore(page, "open");
  await buyer.goto(`/${slug}`);
  await expect(status(buyer)).toHaveText("Open");
  await expect(buyer.getByRole("region", { name: "Stock" })).toBeVisible();
});

for (const to of ["pause", "off"] as const)
  test(`a waiting buyer is warned about, and survives ${to === "off" ? "not vending" : "a pause"}`, async ({
    page,
    browser,
  }) => {
    const slug = await openVendor(page);
    const buyer = await newBuyer(browser, slug);
    await sendList(buyer, slug, ["Mew ex"]);

    await page.goto("/dashboard");
    const control = page.getByRole("region", { name: "Your store" });
    await control
      .getByRole("button", {
        name: to === "off" ? "Not vending" : "Pause",
        exact: true,
      })
      .click();
    await expect(
      control.getByText(
        "1 buyer is waiting. Their holds stay until you confirm or decline.",
      ),
    ).toBeVisible();
    // Keep backs out without changing anything.
    await control.getByRole("button", { name: "Keep it open" }).click();
    await expect(control).toHaveAttribute("data-state", "open");

    await setStore(page, to === "off" ? "off" : { pause: "Until I reopen" });
    await buyer.reload();
    await sent(buyer);
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Review sale" }).first().click();
    await expect(
      page.getByRole("heading", { name: /^Sale for/ }),
    ).toBeVisible();
  });
