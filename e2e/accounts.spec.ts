import { expect, test } from "@playwright/test";
import { admin } from "../playwright.config";
import {
  choosePassword,
  join,
  mintInvite,
  newLink,
  newVendor,
  noticeSent,
  PASSWORD,
  passwordSignIn,
  signIn,
} from "./auth";
import { confirmAndView, openVendor, pay, reviewSale } from "./buyer";
import { hasDb, userExists } from "./db";

const fresh = () =>
  `e2e-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.test`;

async function forgot(page: import("@playwright/test").Page, email: string) {
  return newLink(email, async () => {
    await page.goto("/login/forgot");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Email me a link" }).click();
    await expect(
      page.getByText("Check your email.", { exact: true }),
    ).toBeVisible();
  });
}

test("forgot password: the link sets a new one once, and only the new one works", async ({
  page,
  browser,
}) => {
  const id = await newVendor(page);
  const email = `e2e-${id}@example.test`;
  const other = await browser.newPage();
  const link = await forgot(other, email);
  expect(link).toContain("/login/reset?token=");
  await other.goto(link);
  const next = "a-brand-new-password";
  await other.getByLabel("New password").fill(next);
  await other.getByLabel("Type it again").fill("not-the-same");
  await other.getByRole("button", { name: "Save and sign in" }).click();
  await expect(other.locator("#password-error")).toHaveText(/don't match/);
  await other.getByLabel("New password").fill(next);
  await other.getByLabel("Type it again").fill(next);
  await other.getByRole("button", { name: "Save and sign in" }).click();
  await expect(other.getByText("Your public page").first()).toBeVisible();

  // Spent: the same link can't set another.
  const again = await browser.newPage();
  await again.goto(link);
  await choosePassword(again, "Save and sign in");
  await expect(again.getByText(/expired or was already used/)).toBeVisible();

  // The old password is gone and the new one works.
  const fresh1 = await browser.newPage();
  await passwordSignIn(fresh1, email, PASSWORD);
  await expect(fresh1.locator("#login-error")).toBeVisible();
  await passwordSignIn(fresh1, email, next);
  await expect(fresh1.getByText("Your public page").first()).toBeVisible();
});

test("changing the password needs the current one and signs out other devices", async ({
  page,
  browser,
}) => {
  const id = await newVendor(page);
  const email = `e2e-${id}@example.test`;
  const phone = await browser.newPage();
  await passwordSignIn(phone, email);
  await expect(phone.getByText("Your public page").first()).toBeVisible();

  await page.goto("/dashboard/settings");
  const form = page.getByRole("region", { name: "Change password" });
  await form.getByLabel("Current password").fill("wrong-current");
  await form.getByLabel("New password").fill("changed-password-9");
  await form.getByLabel("Type it again").fill("changed-password-9");
  await form.getByRole("button", { name: "Change password" }).click();
  await expect(form.getByRole("alert")).toHaveText(/isn't right/);
  await form.getByLabel("Current password").fill(PASSWORD);
  await form.getByLabel("New password").fill("changed-password-9");
  await form.getByLabel("Type it again").fill("changed-password-9");
  await form.getByRole("button", { name: "Change password" }).click();
  await expect(form.getByRole("status")).toHaveText(/Password changed/);

  // This device stays in; the other one is out.
  await page.goto("/dashboard");
  await expect(page.getByText("Your public page").first()).toBeVisible();
  await phone.goto("/dashboard");
  await expect(phone).toHaveURL(/\/login/);
  await passwordSignIn(phone, email, "changed-password-9");
  await expect(phone.getByText("Your public page").first()).toBeVisible();
});

test("an account without a password is asked to set one", async ({ page }) => {
  // Joins but leaves /welcome without choosing one, like the old link-only accounts.
  const email = fresh();
  await page.goto(await join(page, (await mintInvite(page)).code, email));
  await expect(page).toHaveURL(/\/welcome/);
  await page.goto("/dashboard");
  const nudge = page.getByRole("region", { name: "Set a password" });
  await nudge.getByRole("link", { name: "Set password" }).click();
  await choosePassword(page, "Save password");
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(nudge).toHaveCount(0);
  await page.context().clearCookies();
  await passwordSignIn(page, email);
  await expect(page).toHaveURL(/\/dashboard/);
});

test("someone asks for an invite, the admin invites them, and they set up", async ({
  page,
  browser,
}) => {
  test.skip(!hasDb, "needs DATABASE_URL");
  const name = `Ash ${Date.now()}`;
  const email = fresh();
  const asker = await browser.newPage();
  await asker.goto("/");
  await asker.getByRole("link", { name: "Get an invite" }).click();
  await asker.getByLabel("Your name").fill(name);
  await asker.getByLabel("Email").last().fill(email);
  await asker.getByLabel("How do you sell? (optional)").fill("Weekend shows");
  await asker.getByRole("button", { name: "Ask for an invite" }).click();
  await expect(asker.getByText(/emailed you to confirm/)).toBeVisible();
  await noticeSent(email, "request-received");

  // A second, unwanted request to dismiss.
  const other = await browser.newPage();
  const spam = `Spam ${Date.now()}`;
  await other.goto("/join");
  await other.getByLabel("Your name").fill(spam);
  const spamEmail = fresh();
  await other.getByLabel("Email").last().fill(spamEmail);
  await other.getByRole("button", { name: "Ask for an invite" }).click();
  await expect(other.getByText(/emailed you to confirm/)).toBeVisible();

  await signIn(page, admin(5));
  await page.goto("/admin");
  const requests = page.getByRole("region", { name: "Invite requests" });
  await expect(requests.getByText("Weekend shows")).toBeVisible();
  await requests.getByRole("button", { name: `Dismiss ${spam}` }).click();
  await expect(requests.getByText(spam)).toHaveCount(0);
  await noticeSent(spamEmail, "request-declined");
  const link = await newLink(email, () =>
    requests.getByRole("button", { name: `Invite ${name}` }).click(),
  );
  await expect(requests.getByText(name)).toHaveCount(0);

  await asker.goto(link);
  await expect(asker).toHaveURL(/\/welcome/);
  await choosePassword(asker, "Save password");
  await expect(asker.getByLabel("Store name")).toBeVisible();
  expect(await userExists(email)).toBe(true);
});

test("the admin can email an invite straight to someone", async ({
  page,
  browser,
}) => {
  test.skip(!hasDb, "needs DATABASE_URL");
  const email = fresh();
  await signIn(page, admin(6));
  await page.goto("/admin");
  await page.getByLabel("Who's it for? (optional)").fill("Misty");
  await page.getByLabel("Email it to (optional)").fill(email);
  const link = await newLink(email, () =>
    page.getByRole("button", { name: "Create invite" }).click(),
  );
  await expect(page.getByText(`Emailed to ${email}.`)).toBeVisible();

  const misty = await browser.newPage();
  await misty.goto(link);
  await expect(misty).toHaveURL(/\/welcome/);
  await choosePassword(misty, "Save password");
  await expect(misty.getByLabel("Store name")).toBeVisible();
});

test("a vendor moves to a new email: the link confirms it, the old one is told", async ({
  page,
  browser,
}) => {
  const id = await newVendor(page);
  const old = `e2e-${id}@example.test`;
  const next = fresh();
  await page.goto("/dashboard/settings");
  const form = page.getByRole("region", { name: "Change email" });
  await form.getByLabel("New email").fill(admin(0));
  await form.getByLabel("Your password").fill(PASSWORD);
  await form.getByRole("button", { name: "Send confirm link" }).click();
  await expect(form.getByRole("alert")).toHaveText(/can't be used/);
  await form.getByLabel("New email").fill(next);
  await form.getByLabel("Your password").fill("wrong-password");
  await form.getByRole("button", { name: "Send confirm link" }).click();
  await expect(form.getByRole("alert")).toHaveText(/isn't right/);
  const link = await newLink(next, async () => {
    await form.getByLabel("Your password").fill(PASSWORD);
    await form.getByRole("button", { name: "Send confirm link" }).click();
    await expect(form.getByRole("status")).toContainText(next);
  });

  // Opening the link alone changes nothing; the button does, once.
  const inbox = await browser.newPage();
  await inbox.goto(link);
  expect(await userExists(next)).toBe(false);
  await inbox.getByRole("button", { name: "Confirm new email" }).click();
  await expect(inbox.getByText(`Done. Sign in with ${next}`)).toBeVisible();
  await noticeSent(old, "email-changed");
  await inbox.goto(link);
  await inbox.getByRole("button", { name: "Confirm new email" }).click();
  await expect(inbox.getByText(/expired or was already used/)).toBeVisible();

  const fresh2 = await browser.newPage();
  await passwordSignIn(fresh2, old);
  await expect(fresh2.locator("#login-error")).toBeVisible();
  await passwordSignIn(fresh2, next);
  await expect(fresh2.getByText("Your public page").first()).toBeVisible();
});

test("a vendor with sales deletes their account and everything under it", async ({
  page,
  browser,
}) => {
  test.skip(!hasDb, "needs DATABASE_URL");
  const slug = await openVendor(page);
  const email = `${slug}@example.test`;
  // A real sale, so the delete has to get through receipts and the ledger.
  await reviewSale(page, browser, slug, ["Mew ex"]);
  await pay(page, "Cash");
  await confirmAndView(page);
  await expect(page.getByTestId("receipt-no")).toBeVisible();

  await page.goto("/dashboard/settings");
  const form = page.getByRole("region", { name: "Delete account" });
  await form.getByLabel(/Type .delete my account./).fill("delete it");
  await form.getByLabel("Your password").fill(PASSWORD);
  await form.getByRole("button", { name: "Delete my account" }).click();
  await expect(form.getByRole("alert")).toHaveText(/to confirm/);
  await form.getByLabel(/Type .delete my account./).fill("delete my account");
  await form.getByLabel("Your password").fill(PASSWORD);
  await form.getByRole("button", { name: "Delete my account" }).click();
  await expect(page).toHaveURL(/\/login\?deleted=1/);
  await expect(page.getByText("Your account was deleted.")).toBeVisible();

  expect(await userExists(email)).toBe(false);
  await noticeSent(email, "account-deleted");
  expect((await page.request.get(`/${slug}`)).status()).toBe(404);
  await passwordSignIn(page, email);
  await expect(page.locator("#login-error")).toBeVisible();
});
