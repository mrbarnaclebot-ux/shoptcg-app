import { expect, test } from "@playwright/test";

test("home loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "shoptcg" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Vendor sign in" }),
  ).toBeVisible();
});

test("login page renders", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Vendor sign in" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
});

test("terms page renders", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "Terms" })).toBeVisible();
  await expect(page.getByText("We do not sell your data")).toBeVisible();
});
