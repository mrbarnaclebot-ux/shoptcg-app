import { expect, test, type Page } from "@playwright/test";
import { admin } from "../playwright.config";
import {
  join,
  newLink,
  mintInvite,
  newVendor,
  outboxLines,
  passwordSignIn,
  signIn,
} from "./auth";
import {
  expireInvite,
  hasDb,
  inviteRow,
  invitesLabelled,
  userExists,
} from "./db";

const fresh = () =>
  `e2e-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.test`;

// Links send after the response, so "nothing sent" needs a moment to be true.
const settle = (page: Page) => page.waitForTimeout(1500);

const NO_INVITE = /needs an active invite/;

test("a stranger at the login page gets the same answer and nothing else", async ({
  page,
}) => {
  test.skip(!hasDb, "needs DATABASE_URL");
  const email = fresh();
  await passwordSignIn(page, email, "not-a-password");
  await expect(page.locator("#login-error")).toHaveText(
    /^Wrong email or password\./,
  );
  await page.goto("/login/forgot");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a link" }).click();
  await expect(
    page.getByText(/^If this address has a vendor account, we sent a link/),
  ).toBeVisible();
  await settle(page);
  expect(await outboxLines(email)).toBe(0);
  expect(await userExists(email)).toBe(false);
});

test("the public send route is closed, so nobody can email links past our limits", async ({
  page,
}) => {
  const email = fresh();
  const res = await page.request.post("/api/auth/sign-in/magic-link", {
    data: { email, callbackURL: "/dashboard" },
  });
  expect(res.status()).toBe(404);
  // Password sign-in, sign-up and resets only run through our limited actions.
  for (const path of [
    "sign-in/email",
    "sign-up/email",
    "request-password-reset",
    "reset-password",
  ])
    expect(
      (
        await page.request.post(`/api/auth/${path}`, {
          data: { email, password: "whatever-123", name: "x" },
        })
      ).status(),
    ).toBe(404);
  await settle(page);
  expect(await outboxLines(email)).toBe(0);
});

test("a mangled link is a join page or a 404, never an error", async ({
  page,
}) => {
  const res = await page.goto("/join/%E0%A4");
  expect(res?.status()).toBe(200);
  await expect(page).toHaveURL(/\/join$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect((await page.request.get("/%E0%A4")).status()).toBe(404);
  expect((await page.request.get("/some-store/item/%E0%A4")).status()).toBe(
    404,
  );
});

test("a returning vendor signs in with their password; email case doesn't matter", async ({
  page,
  browser,
}) => {
  const id = await newVendor(page);
  const other = await browser.newPage();
  await passwordSignIn(other, `e2e-${id}@example.test`);
  await expect(other.getByText("Your public page").first()).toBeVisible();
  // Typed in capitals, the same account.
  const third = await browser.newPage();
  await passwordSignIn(third, `E2E-${id}@EXAMPLE.TEST`);
  await expect(third.getByText("Your public page").first()).toBeVisible();
  // A wrong password says so, without saying whether the account exists.
  const fourth = await browser.newPage();
  await passwordSignIn(fourth, `e2e-${id}@example.test`, "wrong-password");
  await expect(fourth.locator("#login-error")).toHaveText(
    /^Wrong email or password\./,
  );
});

test("a used code, an expired code and a wrong code each say so", async ({
  page,
}) => {
  test.skip(!hasDb, "needs DATABASE_URL");
  const first = await mintInvite(page);
  const email = fresh();
  await page.goto(await join(page, first.code, email));
  await expect(page).toHaveURL(/\/welcome/);

  const ctx = await page.context().browser()!.newContext();
  const other = await ctx.newPage();
  await other.goto(`/join/${first.code}`);
  await other.getByLabel("Email").fill(fresh());
  await other.getByRole("button", { name: "Email me a link" }).click();
  await expect(other.locator("#join-error")).toHaveText(/already been used/);

  const old = await mintInvite(other);
  await expireInvite(old.id);
  await other.goto(`/join/${old.code}`);
  await other.getByLabel("Email").fill(fresh());
  await other.getByRole("button", { name: "Email me a link" }).click();
  await expect(other.locator("#join-error")).toHaveText(/has expired/);

  await other.goto("/join");
  // /join opens on asking; a code holder switches.
  await other.getByText("I have a code").click();
  await other.getByLabel("Invite code").fill("AAAA-BBBB-CCCC-DDDD");
  await other.getByLabel("Email").fill(fresh());
  await other.getByRole("button", { name: "Email me a link" }).click();
  await expect(other.locator("#join-error")).toHaveText(/isn't right/);
  await ctx.close();
});

test("Check your email can send again or go back for a different address", async ({
  page,
}) => {
  test.skip(!hasDb, "needs DATABASE_URL");
  const { code } = await mintInvite(page);
  const typo = fresh();
  const right = fresh();
  await join(page, code, typo);
  await newLink(typo, () =>
    page.getByRole("button", { name: "Send again" }).click(),
  );
  await expect(page.getByText("Sent again.")).toBeVisible();
  await page.getByRole("button", { name: "Use a different email" }).click();
  // The code is kept; the email field has focus for the fix.
  await expect(page.getByLabel("Invite code")).toHaveValue(code);
  await expect(page.getByLabel("Email")).toBeFocused();
  await newLink(right, async () => {
    await page.getByLabel("Email").fill(right);
    await page.getByRole("button", { name: "Email me a link" }).click();
  });
  await expect(page.getByText(right)).toBeVisible();
});

test("a mistyped email can be corrected; the old link then makes nothing", async ({
  page,
  browser,
}) => {
  test.skip(!hasDb, "needs DATABASE_URL");
  const { code, id } = await mintInvite(page);
  const typo = fresh();
  const right = fresh();
  const typoLink = await join(page, code, typo);
  // Lower case and no hyphens: the same code.
  const rightLink = await join(
    page,
    code.toLowerCase().replaceAll("-", ""),
    right,
  );

  const stale = await browser.newPage();
  await stale.goto(typoLink);
  await expect(stale).toHaveURL(/\/join$/);
  await expect(stale.getByText(NO_INVITE)).toBeVisible();
  expect(await userExists(typo)).toBe(false);

  await page.goto(rightLink);
  await expect(page).toHaveURL(/\/welcome/);
  expect((await inviteRow(id)).redeemed_by).toBeTruthy();
});

test("a vendor who already has an account signs in and leaves the code unused", async ({
  page,
}) => {
  test.skip(!hasDb, "needs DATABASE_URL");
  const id = await newVendor(page);
  await page.context().clearCookies();
  const spare = await mintInvite(page);
  await page.goto(await join(page, spare.code, `e2e-${id}@example.test`));
  await expect(page.getByText("Your public page").first()).toBeVisible();
  const row = await inviteRow(spare.id);
  expect(row.used_at).toBeNull();
  expect(row.reserved_email).toBeNull();
});

test("the admin invites someone, sees it used, and can revoke one in flight", async ({
  page,
  browser,
}) => {
  test.skip(!hasDb, "needs DATABASE_URL");
  const label = `Sam ${Date.now()}`;
  await signIn(page, admin(0));
  await page.goto("/admin");
  await page.getByLabel("Who's it for? (optional)").fill(label);
  await page.getByRole("button", { name: "Create invite" }).click();
  const link = (await page.getByTestId("invite-link").textContent())!;
  expect(link).toMatch(/\/join\/[0-9A-Z]{4}(-[0-9A-Z]{4}){3}$/);

  const sam = await browser.newPage();
  const email = fresh();
  const samLink = await newLink(email, async () => {
    const res = await sam.goto(link);
    expect(res!.headers()["referrer-policy"]).toBe("no-referrer");
    await sam.getByLabel("Email").fill(email);
    await sam.getByRole("button", { name: "Email me a link" }).click();
    await expect(sam.getByText(email)).toBeVisible();
  });
  await page.reload();
  await expect(page.getByText(`Reserved for ${email}`)).toBeVisible();
  await sam.goto(samLink);
  await expect(sam).toHaveURL(/\/welcome/);
  await page.reload();
  await expect(page.getByText(`Used by ${email}`)).toBeVisible();
  await expect(page.getByText(`Invited: ${label}.`)).toBeVisible();

  // Revoked after the link went out: the link no longer makes an account.
  await page.getByRole("button", { name: "Create invite" }).click();
  const second = (await page.getByTestId("invite-link").textContent())!;
  const late = await browser.newPage();
  const lateEmail = fresh();
  const lateLink = await newLink(lateEmail, async () => {
    await late.goto(second);
    await late.getByLabel("Email").fill(lateEmail);
    await late.getByRole("button", { name: "Email me a link" }).click();
    await expect(late.getByText(lateEmail)).toBeVisible();
  });
  await page.reload();
  // By id: the text it's found by changes once revoked.
  const inviteId = await page
    .getByRole("listitem")
    .filter({ hasText: `Reserved for ${lateEmail}` })
    .getAttribute("data-invite");
  const row = page.locator(`li[data-invite="${inviteId}"]`);
  await row.getByRole("button", { name: "Revoke" }).click();
  await row.getByRole("button", { name: "Revoke invite" }).click();
  await expect(row).toContainText("Revoked");
  await late.goto(lateLink);
  await expect(late).toHaveURL(/\/join$/);
  await expect(late.getByText(NO_INVITE)).toBeVisible();
  expect(await userExists(lateEmail)).toBe(false);
});

test("a vendor can't open the admin page or run its actions; nobody signed out can", async ({
  page,
  browser,
}) => {
  test.skip(!hasDb, "needs DATABASE_URL");
  const label = `forged-${Date.now()}`;
  await signIn(page, admin(1));
  await page.goto("/admin");
  await page.getByLabel("Who's it for? (optional)").fill(label);
  // The admin's real create request, to replay with a vendor's session.
  const [sent] = await Promise.all([
    page.waitForRequest(
      (r) => r.method() === "POST" && Boolean(r.headers()["next-action"]),
    ),
    page.getByRole("button", { name: "Create invite" }).click(),
  ]);
  await expect(page.getByTestId("invite-code")).toBeVisible();
  expect(await invitesLabelled(label)).toBe(1);

  const vendor = await browser.newPage();
  await newVendor(vendor);
  await vendor.goto("/admin");
  await expect(vendor).toHaveURL(/\/dashboard$/);
  await expect(
    vendor.getByRole("link", { name: "Invites and accounts" }),
  ).toHaveCount(0);
  const h = sent.headers();
  const replay = (as: Page) =>
    as.request.post("/admin", {
      headers: {
        "next-action": h["next-action"],
        "content-type": h["content-type"],
        accept: h["accept"],
        origin: new URL(as.url()).origin,
      },
      data: sent.postDataBuffer()!,
      maxRedirects: 0,
    });
  await replay(vendor);
  expect(await invitesLabelled(label)).toBe(1);
  // Control: the same replay as the admin works, so the refusal above is real.
  await replay(page);
  expect(await invitesLabelled(label)).toBe(2);

  const anon = await browser.newPage();
  await anon.goto("/admin");
  await expect(anon).toHaveURL(/\/login/);
});

// Screenshots, not a regression test: SHOTS=invites pnpm e2e invites
const OUT = ".planning/phases/invites/shots";
const ADMIN_FOR: Record<number, string> = { 390: admin(2), 1280: admin(3) };
for (const width of [390, 1280]) {
  test(`invite screens at ${width}`, async ({ page, browser }) => {
    test.skip(process.env.SHOTS !== "invites", "set SHOTS=invites");
    const shot = async (p: Page, name: string, fullPage = true) => {
      await p.addStyleTag({ content: "nextjs-portal { display: none }" });
      await p.waitForTimeout(800);
      await p.screenshot({
        path: `${OUT}/${name}-${width}.png`,
        fullPage,
      });
    };
    const size = { width, height: 900 };
    await page.setViewportSize(size);
    await page.goto("/login");
    await shot(page, "login");
    const { code } = await mintInvite(page);
    await page.goto(`/join/${code}`);
    await shot(page, "join");
    await page.getByLabel("Invite code").fill("WRONG");
    await page.getByLabel("Email").fill(fresh());
    await page.getByRole("button", { name: "Email me a link" }).click();
    await expect(page.locator("#join-error")).toBeVisible();
    await shot(page, "join-error");
    const owner = await browser.newPage({ viewport: size });
    await signIn(owner, ADMIN_FOR[width]);
    await owner.goto("/admin");
    await owner.getByLabel("Who's it for? (optional)").fill("Sam at table 12");
    await owner.getByRole("button", { name: "Create invite" }).click();
    await expect(owner.getByTestId("invite-code")).toBeVisible();
    // Viewport only: the lists below run long on a test database.
    await shot(owner, "admin", false);
  });
}
