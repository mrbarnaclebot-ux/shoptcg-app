import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, expect, test, vi } from "vitest";
import type { Db } from "@/db/open";
import { listing, receiptEmail, store } from "@/db/schema";
import { renderReceipt, type ReceiptData } from "@/lib/receipt-email";
import { createRequest } from "@/lib/requests";
import { confirmSale } from "@/lib/sales";
import { addStore, migratedDb } from "@/lib/test-fixtures";

vi.mock("server-only", () => ({}));
const { deliverReceipt, MAX_ATTEMPTS } = await import("@/lib/receipts");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const data = (over: Partial<ReceiptData> = {}): ReceiptData => ({
  storeName: "Zard's Cards",
  receiptNo: "R-0042",
  buyerName: "Maya",
  createdAt: new Date("2026-11-09T12:00:00Z"),
  timeZone: "UTC",
  subtotal: "90.00",
  discount: "10.00",
  total: "80.00",
  method: "cash",
  note: null,
  secondCurrency: "AUD",
  fxRate: "1.52",
  lines: [
    { name: "Mew ex", meta: "151 NM", imageUrl: null, qty: 2, unitPrice: "45" },
  ],
  unsubscribeUrl: null,
  ...over,
});

test("every attacker-controlled string is escaped", () => {
  const { html, text } = renderReceipt(
    data({
      buyerName: "<script>alert(1)</script>",
      storeName: '"><img src=x onerror=alert(1)>',
      lines: [
        {
          name: "<b>Mew</b>",
          meta: "&",
          imageUrl: 'x" onerror="alert(1)',
          qty: 1,
          unitPrice: "1",
        },
      ],
    }),
  );
  expect(html).not.toContain("<script>");
  expect(html).not.toContain("<img src=x");
  expect(html).not.toContain("<b>Mew</b>");
  expect(html).not.toContain('" onerror="');
  expect(html).toContain("&lt;script&gt;");
  // Plain text carries it literally: nothing renders it as markup.
  expect(text).toContain("<b>Mew</b>");
});

test("the unsubscribe link appears only for opted-in buyers", () => {
  expect(renderReceipt(data()).html).not.toContain("Unsubscribe");
  expect(renderReceipt(data()).text).not.toContain("Unsubscribe");
  const on = renderReceipt(data({ unsubscribeUrl: "https://x.test/u/abc" }));
  expect(on.html).toContain("https://x.test/u/abc");
  expect(on.text).toContain("https://x.test/u/abc");
});

test("the receipt has totals, the method, the rate and a clean subject", () => {
  const { html, text, subject } = renderReceipt(
    data({ storeName: "Cards\r\nBcc: x@y.test" }),
  );
  expect(subject).toBe("Your receipt from Cards Bcc: x@y.test (R-0042)");
  expect(html).toContain("$80.00");
  expect(html).toContain("Cash");
  expect(text).toContain("Approx. A$122 at 1.52 AUD to 1 USD");
  expect(html.length).toBeLessThan(40_000);
});

async function soldRequest(db: Db) {
  const storeId = await addStore(db, randomUUID().slice(0, 8));
  await db.update(store).set({ isOpen: true }).where(eq(store.id, storeId));
  const [l] = await db
    .insert(listing)
    .values({
      storeId,
      kind: "raw",
      language: "en",
      name: "Mew ex",
      condition: "NM",
      qty: 2,
      overridePrice: "10",
    })
    .returning({ id: listing.id });
  const r = await createRequest(db, {
    storeId,
    lines: [{ listingId: l.id, qty: 1 }],
    buyerName: "Maya",
    buyerEmail: "maya@example.test",
    promo: true,
    sessionId: randomUUID(),
    ipHash: null,
    holdMs: 60_000,
  });
  if (!r.ok) throw new Error("request failed");
  const sold = await confirmSale(db, storeId, {
    requestId: r.id,
    lines: [{ listingId: l.id, qty: 1, unitPrice: "10" }],
    discount: { kind: "none" },
    method: "cash",
  });
  if (!("ok" in sold)) throw new Error("sale failed");
  return sold.saleId;
}

const state = async (db: Db, id: string) =>
  (await db.select().from(receiptEmail).where(eq(receiptEmail.saleId, id)))[0];

test("a provider refusal is recorded, never thrown, and a resend can recover", async () => {
  const db = await migratedDb();
  const id = await soldRequest(db);
  expect(await state(db, id)).toMatchObject({ status: "pending", attempts: 0 });
  vi.stubEnv("RESEND_API_KEY", "fake");
  vi.stubEnv("BETTER_AUTH_URL", "https://shoptcg.test");
  vi.spyOn(console, "error").mockImplementation(() => {});
  const refuse = vi.fn(
    async () => new Response("domain not verified", { status: 403 }),
  );
  vi.stubGlobal("fetch", refuse);
  expect(await deliverReceipt(db, id)).toBe(false);
  expect(await state(db, id)).toMatchObject({
    status: "failed",
    attempts: 1,
    lastError: "Resend failed: 403 domain not verified",
  });

  const accept = vi.fn(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", accept);
  expect(await deliverReceipt(db, id)).toBe(true);
  expect(await state(db, id)).toMatchObject({
    status: "sent",
    lastError: null,
  });
  const body = JSON.parse(
    (accept.mock.calls[0] as unknown as [string, { body: string }])[1].body,
  );
  expect(body.to).toBe("maya@example.test");
  expect(body.subject).toContain("R-0001");
  expect(body.headers["List-Unsubscribe-Post"]).toBe(
    "List-Unsubscribe=One-Click",
  );
  expect(body.headers["List-Unsubscribe"]).toContain("/api/unsubscribe?t=");
});

test("resends stop at the attempt cap", async () => {
  const db = await migratedDb();
  const id = await soldRequest(db);
  vi.stubEnv("RESEND_API_KEY", "fake");
  vi.stubEnv("BETTER_AUTH_URL", "https://shoptcg.test");
  const accept = vi.fn(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", accept);
  for (let i = 0; i < MAX_ATTEMPTS; i++)
    expect(await deliverReceipt(db, id)).toBe(true);
  expect(await deliverReceipt(db, id)).toBe(false);
  expect(accept).toHaveBeenCalledTimes(MAX_ATTEMPTS);
});
