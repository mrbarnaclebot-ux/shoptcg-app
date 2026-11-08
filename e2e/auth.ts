import { readFile } from "node:fs/promises";
import { expect, type Page } from "@playwright/test";
import { OUTBOX } from "../playwright.config";

/** Signs in through the real magic-link flow, reading the link from the outbox. */
export async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a link" }).click();
  await expect(page.getByText("Check your email.")).toBeVisible();
  let url: string | undefined;
  await expect
    .poll(async () => {
      const lines = await readFile(OUTBOX, "utf8").catch(() => "");
      url = lines
        .split("\n")
        .findLast((l) => l.startsWith(`${email} `))
        ?.split(" ")[1];
      return url;
    })
    .toBeTruthy();
  await page.goto(url!);
  await expect(page).toHaveURL(/\/dashboard/);
}

/** Signs in a brand-new vendor and creates their store. */
export async function newVendor(page: Page) {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await signIn(page, `e2e-${id}@example.test`);
  await page.getByLabel("Store name").fill(`E2E Cards ${id}`);
  await page.getByLabel("Store link").fill(`e2e-${id}`);
  await page.getByRole("button", { name: "Create store" }).click();
  await expect(page.getByText("Public page")).toBeVisible();
  return id;
}
