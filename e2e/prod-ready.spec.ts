import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { newVendor } from "./auth";
import { setStore } from "./buyer";

test("every response carries the security headers", async ({ request }) => {
  for (const path of ["/", "/login", "/no-such-store", "/api/health"]) {
    const h = (await request.get(path)).headers();
    expect(h["content-security-policy"], path).toContain(
      "frame-ancestors 'self'",
    );
    expect(h["x-frame-options"], path).toBe("SAMEORIGIN");
    expect(h["x-content-type-options"], path).toBe("nosniff");
    expect(h["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
    expect(h["strict-transport-security"], path).toMatch(/max-age=\d+/);
    expect(h["permissions-policy"], path).toContain("camera=()");
    expect(h["x-powered-by"], path).toBeUndefined();
  }
  // The invite code is in the URL, so it keeps its stricter policy.
  const join = (await request.get("/join")).headers();
  expect(join["referrer-policy"]).toBe("no-referrer");
});

test("robots and sitemap are real files", async ({ request, baseURL }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(robots.headers()["content-type"]).toContain("text/plain");
  expect(await robots.text()).toContain(`Sitemap: ${baseURL}/sitemap.xml`);
  const map = await request.get("/sitemap.xml");
  expect(map.status()).toBe(200);
  expect(await map.text()).toContain(`<loc>${baseURL}/terms</loc>`);
});

async function noSeriousViolations(page: Page, name: string) {
  await expect(async () => {
    const { violations } = await new AxeBuilder({ page }).analyze();
    const bad = violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(" | ")}`);
    expect(bad, `accessibility on ${name}`).toEqual([]);
  }).toPass({ timeout: 5000 });
}

test("public pages outside the journey pass axe", async ({ page, browser }) => {
  for (const [path, heading] of [
    ["/login", "Sign in"],
    ["/join", undefined],
    ["/terms", "Terms"],
    ["/help", "Help"],
    ["/no-such-store", "We can't find that store."],
  ] as const) {
    await page.goto(path);
    if (heading)
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await noSeriousViolations(page, path);
  }

  // A sold-out item, as a buyer sees it.
  const id = await newVendor(page);
  const res = await page.request.post("/api/e2e/seed");
  expect(res.ok()).toBe(true);
  const { sold } = (await res.json()) as { sold: string };
  await page.goto("/dashboard");
  await setStore(page, "open");
  const buyer = await (await browser.newContext()).newPage();
  await buyer.goto(`/e2e-${id}/item/${sold}`);
  await expect(buyer.getByText("Sold out").first()).toBeVisible();
  await noSeriousViolations(buyer, "sold-out item");
  await buyer.context().close();
});
