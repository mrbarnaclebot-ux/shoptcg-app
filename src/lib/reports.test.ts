import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/open";
import * as schema from "@/db/schema";
import {
  request,
  sale,
  saleLine,
  store,
  type PaymentMethod,
} from "@/db/schema";
import {
  MAX_SPAN_DAYS,
  addDays,
  parseRange,
  reportCsvRows,
  salesReport,
  weekendOf,
  type Range,
} from "@/lib/reports";
import { addStore, migratedDb } from "@/lib/test-fixtures";

let seq = 0;

/** A sale at an exact moment; the real flow can't backdate, and sales can't be updated. */
async function addSale(
  db: Db,
  storeId: string,
  at: string,
  over: {
    total?: string;
    discount?: string;
    method?: PaymentMethod;
    note?: string;
    zone?: string;
    name?: string;
    lines?: Partial<typeof saleLine.$inferInsert>[];
  } = {},
) {
  const [r] = await db
    .insert(request)
    .values({
      storeId,
      code: "2222",
      status: "confirmed",
      termsVersion: "1",
      sessionId: randomUUID(),
      createdAt: new Date(new Date(at).getTime() - 60_000),
      expiresAt: new Date(new Date(at).getTime() + 60_000),
    })
    .returning({ id: request.id });
  const total = over.total ?? "10.00";
  const discount = over.discount ?? "0";
  const n = ++seq;
  const [s] = await db
    .insert(sale)
    .values({
      storeId,
      requestId: r.id,
      seq: n,
      receiptNo: `R-${n}`,
      storeName: "Ridgeline",
      timeZone: over.zone ?? "UTC",
      buyerName: over.name ?? "Maya Robinson",
      buyerEmail: "maya@example.test",
      subtotal: (Number(total) + Number(discount)).toFixed(2),
      discount,
      total,
      paymentMethod: over.method ?? "cash",
      paymentNote: over.note ?? null,
      createdAt: new Date(at),
    })
    .returning({ id: sale.id });
  await db.insert(saleLine).values(
    (over.lines ?? [{}]).map((l, i) => ({
      saleId: s.id,
      lineNo: i + 1,
      listingId: randomUUID(),
      name: "Mew ex",
      language: "en",
      qty: 1,
      unitPrice: total,
      quotedPrice: total,
      ...l,
    })),
  );
}

const day = (from: string, to: string, timeZone: string): Range => ({
  from,
  to,
  timeZone,
  preset: "custom",
});

describe("parseRange", () => {
  const now = new Date("2026-11-11T12:00:00Z"); // A Wednesday.

  it("defaults to today on the seller's calendar, not the server's", () => {
    const late = new Date("2026-11-08T14:00:00Z");
    expect(parseRange({}, "UTC", late)).toMatchObject({
      from: "2026-11-08",
      to: "2026-11-08",
      preset: "today",
    });
    expect(parseRange({}, "Australia/Sydney", late)).toMatchObject({
      from: "2026-11-09",
      to: "2026-11-09",
      preset: "today",
    });
  });

  it("finds the weekend from any day", () => {
    const sun = { from: "2026-11-07", to: "2026-11-08" };
    expect(weekendOf("2026-11-11")).toEqual(sun); // Wednesday: the last one.
    expect(weekendOf("2026-11-08")).toEqual(sun); // Sunday: this one.
    expect(weekendOf("2026-11-07")).toEqual(sun); // Saturday: this one.
    expect(weekendOf("2026-11-09")).toEqual(sun); // Monday.
    expect(weekendOf("2026-11-13")).toEqual(sun); // Friday.
    expect(parseRange(sun, "UTC", now).preset).toBe("weekend");
  });

  it("swaps a backwards range and cuts a long one", () => {
    expect(
      parseRange({ from: "2026-11-09", to: "2026-11-01" }, "UTC", now),
    ).toMatchObject({ from: "2026-11-01", to: "2026-11-09", preset: "custom" });
    const long = parseRange(
      { from: "2020-01-01", to: "2026-01-01" },
      "UTC",
      now,
    );
    expect(long.from).toBe("2020-01-01");
    expect(long.to).toBe(addDays("2020-01-01", MAX_SPAN_DAYS - 1));
  });

  it("one date means that one day", () => {
    expect(parseRange({ from: "2026-11-01" }, "UTC", now)).toMatchObject({
      from: "2026-11-01",
      to: "2026-11-01",
    });
    expect(parseRange({ to: "2026-11-01" }, "UTC", now)).toMatchObject({
      from: "2026-11-01",
      to: "2026-11-01",
    });
  });

  it.each([
    "2026-02-30",
    "0000-01-01",
    "2026-13-01",
    "'; drop table sale",
    "",
    ["2026-11-01", "2026-11-02"],
  ])("ignores %j", (from) => {
    expect(parseRange({ from }, "UTC", now).preset).toBe("today");
  });
});

describe("salesReport", () => {
  let db: Db;
  beforeAll(async () => {
    db = await migratedDb();
  });
  const storeOf = () => addStore(db, randomUUID().slice(0, 8));
  const count = async (id: string, r: Range) =>
    (await salesReport(db, id, r)).summary.sales;

  it("a sale lands on the seller's day across midnight", async () => {
    const id = await storeOf();
    await addSale(db, id, "2026-11-08T12:30:00Z"); // 23:30 Nov 8 in Sydney.
    await addSale(db, id, "2026-11-08T13:30:00Z"); // 00:30 Nov 9 in Sydney.
    expect(await count(id, day("2026-11-08", "2026-11-08", "UTC"))).toBe(2);
    const syd = "Australia/Sydney";
    expect(await count(id, day("2026-11-08", "2026-11-08", syd))).toBe(1);
    expect(await count(id, day("2026-11-09", "2026-11-09", syd))).toBe(1);
  });

  it("a day stays whole when the clocks change", async () => {
    const id = await storeOf();
    const la = "America/Los_Angeles";
    // Clocks go back on Nov 1: a 25 hour day.
    await addSale(db, id, "2026-11-01T06:30:00Z"); // 23:30 Oct 31.
    await addSale(db, id, "2026-11-01T07:30:00Z"); // 00:30 Nov 1.
    await addSale(db, id, "2026-11-02T07:30:00Z"); // 23:30 Nov 1.
    await addSale(db, id, "2026-11-02T08:30:00Z"); // 00:30 Nov 2.
    expect(await count(id, day("2026-11-01", "2026-11-01", la))).toBe(2);
    // Clocks go forward on Mar 8: a 23 hour day.
    await addSale(db, id, "2026-03-08T08:30:00Z"); // 00:30 Mar 8.
    await addSale(db, id, "2026-03-09T06:30:00Z"); // 23:30 Mar 8.
    await addSale(db, id, "2026-03-09T07:30:00Z"); // 00:30 Mar 9.
    expect(await count(id, day("2026-03-08", "2026-03-08", la))).toBe(2);
    expect(await count(id, day("2026-03-09", "2026-03-09", la))).toBe(1);
  });

  it("matches a hand-counted show", async () => {
    const id = await storeOf();
    const other = await storeOf();
    const at = "2026-11-07T15:00:00Z";
    await addSale(db, id, at, {
      total: "100.00",
      lines: [
        { name: "Charizard ex", qty: 1, unitPrice: "80.00" },
        { name: "Mew ex", qty: 2, unitPrice: "10.00" },
      ],
    });
    await addSale(db, id, at, {
      total: "45.50",
      discount: "4.50",
      method: "cash",
      lines: [{ name: "Mew ex", qty: 5, unitPrice: "10.00" }],
    });
    await addSale(db, id, at, {
      total: "20.25",
      method: "card",
      lines: [
        {
          name: "Pikachu",
          language: "ja",
          qty: 3,
          unitPrice: "6.75",
          catalogItemId: randomUUID(),
        },
      ],
    });
    await addSale(db, id, "2026-11-01T15:00:00Z", { total: "999.00" });
    await addSale(db, other, at, { total: "777.00" });

    const r = await salesReport(db, id, day("2026-11-07", "2026-11-08", "UTC"));
    expect(r.summary).toEqual({
      sales: 3,
      revenue: "165.75",
      items: 11,
      average: 55.25,
      discounts: "4.50",
    });
    expect(r.byMethod).toEqual([
      { method: "cash", sales: 2, total: "145.50" },
      { method: "card", sales: 1, total: "20.25" },
      { method: "transfer", sales: 0, total: "0" },
      { method: "other", sales: 0, total: "0" },
    ]);
    const split = r.byMethod.reduce((n, m) => n + Number(m.total), 0);
    expect(split).toBe(Number(r.summary.revenue));
    expect(
      r.bestSellers.map((b) => [b.name, b.qty, Number(b.revenue)]),
    ).toEqual([
      ["Charizard ex", 1, 80],
      ["Mew ex", 7, 70],
      ["Pikachu", 3, 20.25],
    ]);
    expect(r.bestSellers[2].language).toBe("ja");
    expect(r.sales).toHaveLength(3);
    expect(r.sales.flatMap((s) => s.lines)).toHaveLength(4);
  });

  it("an empty range adds up to nothing", async () => {
    const r = await salesReport(
      db,
      await storeOf(),
      day("2026-11-07", "2026-11-08", "UTC"),
    );
    expect(r.summary).toEqual({
      sales: 0,
      revenue: "0",
      items: 0,
      average: 0,
      discounts: "0",
    });
    expect(r.byMethod.every((m) => m.sales === 0)).toBe(true);
  });

  it("the CSV has a row per line, a first name and the sale's own zone", async () => {
    const id = await storeOf();
    await addSale(db, id, "2026-11-08T13:30:00Z", {
      zone: "Australia/Sydney",
      name: "  =cmd|' /C calc'!A0 Robinson",
      method: "other",
      note: "Trade",
      lines: [
        { name: "Mew ex", qty: 2, unitPrice: "5.00", number: "205" },
        { name: "Pikachu", language: "ja", gradeLabel: "PSA 10" },
      ],
    });
    // Picked by the seller's zone today (UTC here), printed in the sale's.
    const [head, a, b] = await reportCsvRows(
      db,
      id,
      day("2026-11-08", "2026-11-08", "UTC"),
    );
    expect(head.length).toBe(a.length);
    expect(a.slice(0, 4)).toEqual([
      "2026-11-09",
      "12:30 AM",
      expect.stringMatching(/^R-/),
      "=cmd|'",
    ]);
    expect(a.slice(4, 11)).toEqual([
      "Mew ex",
      null,
      "205",
      null,
      "EN",
      2,
      "5.00",
    ]);
    expect(a.at(-1)).toBe("Other: Trade");
    expect(b.slice(7, 9)).toEqual(["PSA 10", "JP"]);
    expect(a.join()).not.toContain("maya@");
  });

  it("another store's sales are never in the CSV", async () => {
    const mine = await storeOf();
    await addSale(db, await storeOf(), "2026-11-08T12:00:00Z");
    const rows = await reportCsvRows(
      db,
      mine,
      day("2026-11-08", "2026-11-08", "UTC"),
    );
    expect(rows).toHaveLength(1);
  });
});

// Logged, not asserted: machines differ. Real Postgres only, as PGlite says little.
const url = process.env.DATABASE_URL;
describe.runIf(Boolean(url))("Postgres, 5,000 sales", () => {
  it("logs the report and export times", { timeout: 60_000 }, async () => {
    const client = postgres(url!, { max: 6, onnotice: () => {} });
    const db = drizzle(client, { schema }) as unknown as Db;
    await migrate(db as never, { migrationsFolder: "drizzle" });
    const id = await addStore(db, randomUUID().slice(0, 8));
    try {
      await db.execute(sql`
        with r as (
          insert into request (store_id, code, status, terms_version, session_id, created_at, expires_at)
          select ${id}::uuid, '2222', 'confirmed', '1', gen_random_uuid()::text,
            now() - interval '1 hour', now()
          from generate_series(1, 5000)
          returning id
        ), n as (select id, row_number() over () as i from r),
        s as (
          insert into sale (store_id, request_id, seq, receipt_no, store_name, buyer_name, buyer_email, subtotal, total, payment_method, created_at)
          select ${id}::uuid, id, i, 'R-' || i, 'x', 'Maya Robinson', 'maya@example.test', 40, 40,
            (array['cash','card','transfer','cash'])[1 + i % 4], now() - (i || ' seconds')::interval
          from n
          returning id, seq
        )
        insert into sale_line (sale_id, line_no, listing_id, name, language, qty, unit_price, quoted_price)
        select id, l, gen_random_uuid(), 'Card ' || (seq * l) % 200, 'en', 2, 10, 10
        from s, generate_series(1, 4) l`);
      const r = parseRange(
        { from: "2026-01-01", to: "2026-12-31" },
        "UTC",
        new Date(),
      );
      const time = async <T>(what: string, run: () => Promise<T>) => {
        const t = performance.now();
        const out = await run();
        console.log(
          `[budget] ${what}: ${Math.round(performance.now() - t)} ms`,
        );
        return out;
      };
      const report = await time("report, 5,000 sales", () =>
        salesReport(db, id, r),
      );
      expect(report.summary.sales).toBe(5000);
      const rows = await time("csv, 20,000 lines", () =>
        reportCsvRows(db, id, r),
      );
      expect(rows).toHaveLength(20_001);
      const plan = (await db.execute(
        sql`explain select count(*) from sale where store_id = ${id}::uuid and created_at >= now() - interval '1 day'`,
      )) as unknown as { "QUERY PLAN": string }[];
      console.log(
        "[budget] explain:",
        plan.map((p) => p["QUERY PLAN"]).join(" | "),
      );
    } finally {
      await db.delete(store).where(eq(store.id, id));
      await client.end();
    }
  });
});
