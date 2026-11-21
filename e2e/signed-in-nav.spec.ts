import { expect, test } from "@playwright/test";
import { newVendor } from "./auth";

// A signed-in vendor never meets the sign-in form again by accident: the
// logo stays in the app, the landing link (labelled Dashboard) and /login
// both open the dashboard.
test("signed in, the logo, the landing link and /login lead to the dashboard", async ({
  page,
}) => {
  await newVendor(page);
  const dashboard = page.getByRole("navigation", { name: "Dashboard" });

  await page.goto("/dashboard/sales");
  await page.getByRole("link", { name: "tcgmart.app" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // Signed in, the landing's header link says Dashboard, not sign in.
  await page.goto("/");
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(dashboard).toBeVisible();

  await page.goto("/login");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(dashboard).toBeVisible();
});

test("signed out, the landing link reaches the sign-in form", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Seller sign in" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("an expired session cookie shows the form instead of looping", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([
    {
      name: "better-auth.session_token",
      value: "not-a-real-session.sig",
      url: baseURL!,
    },
  ]);
  await page.goto("/login");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel("Email")).toBeVisible();
  // And the landing link lands there too, via the dashboard's own check.
  await page.goto("/");
  await page.getByRole("link", { name: "Seller sign in" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
