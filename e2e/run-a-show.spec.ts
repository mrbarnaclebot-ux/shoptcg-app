import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { newVendor } from "./auth";
import {
  buyerEmail,
  confirm,
  exported,
  newBuyer,
  outboxLine,
  pay,
  reportRow,
  sendList,
  setStore,
} from "./buyer";
import { saveSettings } from "./settings";

// One vendor runs one whole show against two buyers. Runs at phone, tablet and
// desktop size (playwright.config.ts): `pnpm e2e run-a-show`.
// SHOTS=journey also saves a screenshot per screen.
const SHOTS = process.env.SHOTS === "journey";
const OUT = ".planning/phases/08-e2e/shots";

const CUSTOM = "Mewtwo CN 25th promo";
// Chinese rows are never looked up, so the import needs no price provider.
const CSV = `name,set,number,language,kind,condition,grader,grade,qty,price
Eevee CN starter,,012,zh,raw,NM,,,2,6
Snorlax CN gym promo,,,cn,raw,LP,,,1,14.50
"Lugia CN, anniversary box",,,zh,sealed,,,,1,60
`;

/** No serious or critical accessibility violations, and a shot when asked. */
async function check(page: Page, name: string) {
  // Retried for a few seconds: a title still streaming in, or a colour caught
  // halfway through a transition, isn't what people read. A real one stays.
  await expect(async () => {
    const { violations } = await new AxeBuilder({ page }).analyze();
    const bad = violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(" | ")}`);
    expect(bad, `accessibility on ${name}`).toEqual([]);
  }).toPass({ timeout: 5000 });
  if (SHOTS)
    await page.screenshot({
      path: `${OUT}/${test.info().project.name}-${name}.png`,
    });
}

const tile = (page: Page, name: string) =>
  page.locator("article").filter({ hasText: name });
const stock = (page: Page) =>
  page.getByRole("region", { name: "Stock" }).locator("article");

test("a vendor runs a whole show", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const project = test.info().project.name;
  let slug = "";
  let ids = { zard: "", thin: "" };

  await test.step("sign up, create the store, save settings", async () => {
    slug = `e2e-${await newVendor(page)}`;
    await saveSettings(page, {
      rule: "-10",
      rounding: "Nearest $0.50",
      currency: ["AUD", "1.52"],
      table: "B14",
      nfc: true,
    });
  });

  await test.step("stock the table", async () => {
    // Catalog cards with a market price and history come from the seed route:
    // the UI can't make them, because prices arrive with the nightly sync.
    const res = await page.request.post("/api/e2e/seed");
    expect(res.ok()).toBe(true);
    ids = await res.json();

    await page.goto("/dashboard/inventory/add");
    await page
      .getByRole("button", {
        name: "Not in the catalog, or not a card? Add it yourself",
      })
      .click();
    await page.getByText("Chinese", { exact: true }).click();
    await page.getByLabel("Name").fill(CUSTOM);
    await page.getByLabel("Qty").fill("2");
    await page.getByLabel("Fixed price (optional)").fill("25");
    await page.getByRole("button", { name: "Add custom item" }).click();
    await expect(page.getByText(`Added ${CUSTOM}`)).toBeVisible();

    await page.goto("/dashboard/inventory/import");
    await page.locator("input[type=file]").setInputFiles({
      name: "show.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(CSV),
    });
    await page.getByRole("button", { name: "Import 3 items" }).click();
    await expect(page).toHaveURL(/\/dashboard\/inventory$/);
    for (const name of [CUSTOM, "Eevee CN starter", "Lugia CN, anniversary"])
      await expect(
        page.locator("main li").filter({ hasText: name }),
      ).toBeVisible();
    await check(page, "inventory");
  });

  await test.step("the table sign", async () => {
    await page.goto("/dashboard/sign");
    await expect(page.locator(".ts-table")).toHaveText("TableB14");
    await expect(page.locator(".ts-nfc")).toBeVisible();
    await expect(page.locator("svg[aria-label^='QR code']")).toBeVisible();
    await expect(page.getByTestId("sign-url")).toHaveText(
      new RegExp(`/${slug}$`),
    );
    // One sheet of paper; printing is the same at every window size.
    if (project === "desktop") {
      const pdf = await page.pdf({
        preferCSSPageSize: true,
        printBackground: true,
      });
      const pages = pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? [];
      expect(pages).toHaveLength(1);
    }
    await check(page, "sign");
  });

  await test.step("open the store", async () => {
    await page.goto("/dashboard");
    await setStore(page, "open");
    await expect(page.getByText("Live", { exact: true })).toBeVisible();
  });

  const a = await newBuyer(browser, slug);
  const b = await newBuyer(browser, slug);
  const emailA = buyerEmail();
  let codeA = "";

  await test.step("buyer A browses from the sign", async () => {
    // A buyer's phone is the same size as the seller's.
    expect(a.viewportSize()).toEqual(page.viewportSize());
    await a.goto(`/${slug}?src=sign`);
    // 8 seeded tiles (one listing is hidden), the custom item and 3 imported.
    await expect(stock(a)).toHaveCount(12);
    await expect(tile(a, "Charizard ex")).toContainText("approx. A$404");
    await expect(tile(a, "Charizard ex")).toContainText("10% under market");
    await check(a, "store");

    await a.getByRole("link", { name: "CN", exact: true }).click();
    await expect(a).toHaveURL(/lang=zh/);
    await expect(stock(a)).toHaveCount(5);
    await a.goto(`/${slug}`);
    await a.getByRole("link", { name: "Graded", exact: true }).click();
    await expect(a).toHaveURL(/type=graded/);
    await expect(stock(a)).toHaveCount(1);

    await a.goto(`/${slug}/item/${ids.zard}`);
    await expect(
      a.getByText(/(Up|Down) \d+% in 30 days|Flat over 30 days/),
    ).toBeVisible();
    await check(a, "item");
    await a.goto(`/${slug}/item/${ids.thin}`);
    await expect(
      a.getByText("Not enough price history yet.", { exact: false }),
    ).toBeVisible();
  });

  await test.step("buyer A sends a cart; the seller hears in 3 seconds", async () => {
    await a.goto(`/${slug}`);
    await a.getByRole("button", { name: "Add Mew ex to your cart" }).click();
    await a.getByRole("button", { name: `Add ${CUSTOM} to your cart` }).click();
    await a.getByRole("link", { name: "Review cart" }).click();
    await expect(a.getByRole("heading", { name: "Your cart" })).toBeVisible();
    await check(a, "cart");
    codeA = await sendList(a, slug, [], {
      name: "Ana Reyes",
      email: emailA,
      promo: true,
    });
    await expect(a.getByTestId("hold-clock")).toHaveText(/\d+:\d\d/);
    await expect(page.getByText(codeA, { exact: true })).toBeVisible({
      timeout: 3000,
    });
    await expect(page.getByText("Ana Reyes")).toBeVisible();
    await check(a, "waiting");
    await check(page, "queue");
  });

  await test.step("buyer B can't take the held card, and is declined", async () => {
    await b.goto(`/${slug}`);
    await expect(tile(b, "Mew ex")).toContainText("On hold");
    await expect(
      b.getByRole("button", { name: "Add Mew ex to your cart" }),
    ).toHaveCount(0);

    await sendList(b, slug, ["Umbreon VMAX"], {
      name: "Ben Carter",
      email: buyerEmail(),
    });
    const ticket = page.getByRole("listitem").filter({ hasText: "Ben Carter" });
    await expect(ticket).toBeVisible({ timeout: 3000 });
    await ticket.getByRole("button", { name: "Decline" }).click();
    await expect(ticket.getByText("Decline and release items?")).toBeVisible();
    await ticket.getByRole("button", { name: "Decline" }).click();
    await expect(ticket).toHaveCount(0);
    await expect(
      b.getByRole("heading", { name: "The seller couldn't do this one." }),
    ).toBeVisible();
    await b.goto(`/${slug}`);
    await expect(
      b.getByRole("button", { name: "Add Umbreon VMAX to your cart" }),
    ).toBeVisible();
  });

  let total = "";
  await test.step("the seller edits, discounts and confirms the sale", async () => {
    await page
      .getByRole("listitem")
      .filter({ hasText: "Ana Reyes" })
      .getByRole("link", { name: "Review sale" })
      .click();
    await expect(page.getByTestId("sale-code")).toHaveText(codeA);
    await page.getByLabel(`Price each for ${CUSTOM}`).fill("22");
    await page.getByText("%", { exact: true }).click();
    await page.getByLabel("Percent off").fill("10");
    await pay(page, "Cash");
    // Mew ex is $48.10 less 10%, to the nearest 50c: (43.50 + 22) less 10%.
    await expect(confirm(page)).toHaveText(/\$58\.95/);
    total = "$58.95";
    await check(page, "confirm");
    await confirm(page).click();
    await expect(page.getByTestId("receipt-no")).toHaveText("R-0001");
    await expect(page.getByText("Paid by Cash")).toBeVisible();
    await expect(page.getByText(`Emailed to ${emailA}.`)).toBeVisible();
    await check(page, "receipt");
  });

  let unsubscribe = "";
  await test.step("buyer A is told, and gets a receipt", async () => {
    await expect(a.getByText("Sold. Enjoy your cards!")).toBeVisible({
      timeout: 3000,
    });
    await expect(a.getByText("Paid by Cash")).toBeVisible();
    await check(a, "sold");
    const line = await outboxLine(emailA);
    expect(line).toMatch(/ receipt:R-0001 https?:\/\/.+\/u\/[\w-]{43}$/);
    unsubscribe = line.split(" ")[2];
  });

  await test.step("the store page shows what sold", async () => {
    await b.goto(`/${slug}`);
    await expect(tile(b, "Mew ex")).toContainText("Sold out");
    await expect(tile(b, CUSTOM)).toContainText("Last one");
  });

  await test.step("the day's report adds up", async () => {
    await page.goto("/dashboard/reports");
    await expect(reportRow(page, "Revenue")).toContainText(total);
    await expect(reportRow(page, "Sales")).toContainText("1");
    await expect(reportRow(page, "Items sold")).toContainText("2");
    await expect(page.getByRole("table").getByRole("row").nth(1)).toContainText(
      `Cash`,
    );
    await expect(page.getByRole("table").getByRole("row").nth(1)).toContainText(
      total,
    );
    const best = page
      .getByRole("heading", { name: "Best sellers" })
      .locator("..");
    await expect(best).toContainText("Mew ex");
    await expect(best).toContainText(CUSTOM);
    await check(page, "report");
    const { rows } = await exported(page, "Export CSV");
    expect(rows).toHaveLength(2);
  });

  await test.step("the buyer opted in, then unsubscribes", async () => {
    await page.goto("/dashboard/customers");
    const ana = page.getByRole("listitem").filter({ hasText: "Ana Reyes" });
    await expect(ana).toContainText("Subscribed since");
    await a.goto(unsubscribe);
    await a.getByRole("button", { name: "Unsubscribe" }).click();
    await expect(a.getByRole("heading", { name: /^You're off/ })).toBeVisible();
    await page.reload();
    await expect(ana).toContainText("Unsubscribed");
    await expect(page.getByText("No one has opted in yet.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Export promo list" }),
    ).toBeDisabled();
  });

  await test.step("pack up: the store is browsing only", async () => {
    await page.goto("/dashboard");
    await setStore(page, { pause: "Until I reopen" });
    await a.goto(`/${slug}`);
    await expect(a.getByText("Browsing only.")).toBeVisible();
    await expect(a.getByRole("button", { name: /to your cart/ })).toHaveCount(
      0,
    );
    await expect(a.getByRole("link", { name: "Review cart" })).toHaveCount(0);
  });
});
