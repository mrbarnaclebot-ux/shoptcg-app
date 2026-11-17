import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  buyerEmail,
  confirm,
  newBuyer,
  openVendor,
  outboxLine,
  pay,
} from "./buyer";
import { saveSettings } from "./settings";

const noSeriousA11y = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(
    violations.filter((v) => v.impact === "serious" || v.impact === "critical"),
  ).toEqual([]);
};

async function joinEvent(buyer: Page, name: string, phone: string) {
  const email = buyerEmail();
  await buyer.getByLabel("Your name").fill(name);
  await buyer.getByLabel("WhatsApp number").fill(phone);
  await buyer.getByLabel("Email for your receipt").fill(email);
  await buyer.getByRole("button", { name: "Join the event" }).click();
  await expect(buyer.getByText(/^You're in as/)).toBeVisible();
  return email;
}

const tile = (page: Page, name: string) =>
  page.locator("[data-claim-tile]").filter({ hasText: name });

test("two buyers race for the last unit, the vendor marks it paid, and leftovers go back", async ({
  page,
  browser,
}) => {
  const slug = await openVendor(page);
  await saveSettings(page, { mode: "Online store" });

  await page.goto("/dashboard/events");
  await page.getByRole("link", { name: "New event" }).click();
  await page.getByLabel("Name").fill("Friday drop");
  await page.getByLabel(/^Mew ex/).check();
  await page.getByLabel(/^Umbreon VMAX/).check();
  await page.getByRole("button", { name: "Start event" }).click();
  await expect(
    page.getByRole("heading", { name: "Friday drop", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("Live", { exact: true })).toBeVisible();
  await noSeriousA11y(page);
  const eventUrl = new URL(
    (await page
      .getByRole("region", { name: "Share" })
      .locator("p")
      .first()
      .textContent())!,
  ).pathname;

  // Event stock is off the store page, which links to the event instead.
  const a = await newBuyer(browser, slug);
  await expect(
    a.getByRole("button", { name: "Add Mew ex to your cart" }),
  ).toHaveCount(0);
  await expect(
    a.getByRole("button", { name: "Add Pikachu to your cart" }),
  ).toBeVisible();
  await a.getByRole("link", { name: /Claim now/ }).click();
  await expect(a).toHaveURL(new RegExp(`${eventUrl}$`));

  // A local number can't be turned into a WhatsApp link without a country code.
  await a.getByLabel("Your name").fill("Maya Robinson");
  await a.getByLabel("WhatsApp number").fill("077 123 4567");
  await a.getByLabel("Email for your receipt").fill(buyerEmail());
  await a.getByRole("button", { name: "Join the event" }).click();
  await expect(a.locator("#phone-error")).toHaveText(/country code/);
  const emailA = await joinEvent(a, "Maya Robinson", "+94 77 123 4567");
  await noSeriousA11y(a);

  const b = await newBuyer(browser, slug);
  await b.goto(eventUrl);
  await joinEvent(b, "Sam Perera", "+94 77 765 4321");

  // Both tap the last Mew ex at once: one wins.
  await Promise.all(
    [a, b].map((p) =>
      tile(p, "Mew ex").getByRole("button", { name: "Claim" }).click(),
    ),
  );
  const won = async (p: Page) =>
    (await tile(p, "Mew ex").getByText("You claimed this").count()) > 0;
  await expect
    .poll(async () => (await won(a)) !== (await won(b)), { timeout: 10_000 })
    .toBe(true);
  const [winner, loser] = (await won(a)) ? [a, b] : [b, a];
  const winnerEmail = winner === a ? emailA : null;
  await expect(tile(loser, "Mew ex").getByText("All claimed")).toBeVisible();
  await expect(
    tile(loser, "Mew ex").getByRole("button", { name: "Claim" }),
  ).toHaveCount(0);

  // The vendor sees the claim with a WhatsApp link, and marks it paid.
  await page.reload();
  const claimCard = page.locator("li.paper").filter({ hasText: "Mew ex" });
  await expect(claimCard).toHaveCount(1);
  await expect(
    claimCard.getByRole("link", { name: /^WhatsApp \+947/ }),
  ).toHaveAttribute("href", /^https:\/\/wa\.me\/947/);
  await claimCard.getByRole("link", { name: "Mark as paid" }).click();
  await pay(page, "Cash");
  await confirm(page).click();
  await expect(page.getByTestId("receipt-no")).toBeVisible();
  if (winnerEmail) await outboxLine(winnerEmail);
  await expect(
    winner.getByText("Paid. Your receipt is in your email."),
  ).toBeVisible({
    timeout: 10_000,
  });

  // Ending puts the unclaimed Umbreon back on the store page.
  await page.goto(`/dashboard${eventUrl.replace(`/${slug}/claim`, "/events")}`);
  await page.getByRole("button", { name: "End now" }).click();
  await page.getByRole("button", { name: "Yes, end now" }).click();
  await expect(page.getByText("Ended", { exact: true })).toBeVisible();
  await loser.goto(`/${slug}`);
  await expect(
    loser.getByRole("button", { name: "Add Umbreon VMAX to your cart" }),
  ).toBeVisible();
  await loser.goto(eventUrl);
  await expect(loser.getByText("This event has ended")).toBeVisible();
});

test("a table store is pointed to online selling", async ({ page }) => {
  await openVendor(page);
  await page.goto("/dashboard/events");
  await expect(
    page.getByText(/Claim events are for online stores/),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "New event" })).toHaveCount(0);
});
