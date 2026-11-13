import { readFile } from "node:fs/promises";
import { expect, type Page } from "@playwright/test";
import { OUTBOX } from "../playwright.config";

async function links(email: string) {
  const lines = await readFile(OUTBOX, "utf8").catch(() => "");
  return lines
    .split("\n")
    .filter(
      (l) =>
        l.startsWith(`${email} `) &&
        (l.includes("/api/auth/magic-link") || l.includes("/login/reset")),
    )
    .map((l) => l.split(" ")[1]);
}

/**
 * Runs `send`, then waits for the sign-in link it caused. Links go out after
 * the response, so reading straight away could return an older, spent one.
 */
export async function newLink(email: string, send: () => Promise<unknown>) {
  const before = (await links(email)).length;
  await send();
  let url: string | undefined;
  await expect
    .poll(async () => (url = (await links(email))[before]))
    .toBeTruthy();
  return url!;
}

/** Lines the outbox holds for this address; to prove nothing was sent. */
export async function outboxLines(email: string) {
  const lines = await readFile(OUTBOX, "utf8").catch(() => "");
  return lines.split("\n").filter((l) => l.startsWith(`${email} `)).length;
}

/** Every e2e account's password. */
export const PASSWORD = "e2e-password-1";

/** Fills a new password twice and saves it (welcome, reset). */
export async function choosePassword(page: Page, button: string) {
  await page
    .getByLabel("Password", { exact: true })
    .or(page.getByLabel("New password"))
    .fill(PASSWORD);
  await page.getByLabel("Type it again").fill(PASSWORD);
  await page.getByRole("button", { name: button }).click();
}

/** Email and password on /login. */
export async function passwordSignIn(
  page: Page,
  email: string,
  password = PASSWORD,
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

/**
 * Signs in with the password, or, for an admin's first visit (no account
 * yet), through Forgot password: the emailed link makes the account and
 * /welcome sets the password.
 */
export async function signIn(page: Page, email: string) {
  await passwordSignIn(page, email);
  await expect(
    page
      .locator("#login-error")
      .or(page.getByRole("navigation", { name: "Dashboard" })),
  ).toBeVisible();
  const landed = /\/dashboard/.test(page.url());
  if (landed) return;
  const url = await newLink(email, async () => {
    await page.goto("/login/forgot");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Email me a link" }).click();
    await expect(
      page.getByText("Check your email.", { exact: true }),
    ).toBeVisible();
  });
  await page.goto(url);
  if (page.url().includes("/login/reset"))
    await choosePassword(page, "Save and sign in");
  else await choosePassword(page, "Save password");
  await expect(page).toHaveURL(/\/dashboard/);
}

/** A real invite from the test-only route (E2E builds only). */
export async function mintInvite(page: Page) {
  const res = await page.request.post("/api/e2e/invite");
  expect(res.ok()).toBe(true);
  return (await res.json()) as { code: string; id: string };
}

/** Fills /join, waits for "Check your email", and returns the link it sent. */
export function join(page: Page, code: string, email: string) {
  return newLink(email, async () => {
    await page.goto(`/join/${code}`);
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Email me a link" }).click();
    await expect(
      page.getByText("Check your email.", { exact: true }),
    ).toBeVisible();
  });
}

/** A brand-new vendor who joins with an invite and creates their store. */
export async function newVendor(page: Page) {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const email = `e2e-${id}@example.test`;
  await page.goto(await join(page, (await mintInvite(page)).code, email));
  await expect(page).toHaveURL(/\/welcome/);
  await choosePassword(page, "Save password");
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByLabel("Store name").fill(`E2E Cards ${id}`);
  await page.getByLabel("Store link").fill(`e2e-${id}`);
  await page.getByRole("button", { name: "Create store" }).click();
  await expect(page.getByText("Your public page")).toBeVisible();
  return id;
}
