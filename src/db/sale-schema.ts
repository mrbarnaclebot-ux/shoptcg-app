import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { request } from "./request-schema";
import { store } from "./schema";

export const PAYMENT_METHODS = ["cash", "card", "transfer", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// An immutable record of a confirmed request: triggers in the migration refuse
// any UPDATE, so a receipt matches the cash count forever. Everything a receipt
// shows is a snapshot; delivery state lives in receipt_email.
export const sale = pgTable(
  "sale",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => store.id, { onDelete: "cascade" }),
    requestId: uuid("request_id")
      .notNull()
      .unique()
      .references(() => request.id),
    seq: integer("seq").notNull(),
    receiptNo: text("receipt_no").notNull(),
    storeName: text("store_name").notNull(),
    // The seller's zone when they confirmed: a receipt's time never shifts.
    timeZone: text("time_zone").notNull().default("UTC"),
    buyerName: text("buyer_name").notNull(),
    // Null for a table sale: nobody typed an address, so no receipt is sent.
    buyerEmail: text("buyer_email"),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
    discount: numeric("discount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    discountKind: text("discount_kind", { enum: ["amount", "percent"] }),
    discountPct: numeric("discount_pct", { precision: 5, scale: 2 }),
    total: numeric("total", { precision: 12, scale: 2 }).notNull(),
    paymentMethod: text("payment_method", { enum: PAYMENT_METHODS }).notNull(),
    paymentNote: text("payment_note"),
    secondCurrency: text("second_currency"),
    fxRate: numeric("fx_rate"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("sale_store_seq_key").on(t.storeId, t.seq),
    index("sale_store_created_idx").on(t.storeId, t.createdAt),
    check("sale_total_sum", sql`${t.total} = ${t.subtotal} - ${t.discount}`),
    check(
      "sale_discount_range",
      sql`${t.discount} between 0 and ${t.subtotal}`,
    ),
    check("sale_total_nonneg", sql`${t.total} >= 0`),
    check(
      "sale_discount_kind",
      sql`${t.discountKind} in ('amount', 'percent')`,
    ),
    check("sale_discount_pct_range", sql`${t.discountPct} between 0 and 100`),
    check(
      "sale_payment_method",
      sql`${t.paymentMethod} in ('cash', 'card', 'transfer', 'other')`,
    ),
    check(
      "sale_payment_note",
      sql`(${t.paymentMethod} = 'other') = (${t.paymentNote} is not null) and char_length(${t.paymentNote}) between 1 and 40`,
    ),
  ],
);

// listing_id and catalog_item_id are plain uuids: no foreign key can cascade
// into a receipt.
export const saleLine = pgTable(
  "sale_line",
  {
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sale.id, { onDelete: "cascade" }),
    lineNo: smallint("line_no").notNull(),
    listingId: uuid("listing_id").notNull(),
    catalogItemId: uuid("catalog_item_id"),
    name: text("name").notNull(),
    setName: text("set_name"),
    number: text("number"),
    gradeLabel: text("grade_label"),
    language: text("language").notNull(),
    imageUrl: text("image_url"),
    qty: integer("qty").notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    quotedPrice: numeric("quoted_price", { precision: 12, scale: 2 }).notNull(),
    marketUsd: numeric("market_usd", { precision: 12, scale: 2 }),
    // The listing's cost when it sold, for profit. Null when none was entered.
    unitCost: numeric("unit_cost", { precision: 12, scale: 2 }),
  },
  (t) => [
    primaryKey({ name: "sale_line_pk", columns: [t.saleId, t.lineNo] }),
    check("sale_line_qty_range", sql`${t.qty} between 1 and 99`),
    check("sale_line_price_nonneg", sql`${t.unitPrice} >= 0`),
  ],
);

export const receiptEmail = pgTable(
  "receipt_email",
  {
    saleId: uuid("sale_id")
      .primaryKey()
      .references(() => sale.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["pending", "sent", "failed"] })
      .notNull()
      .default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "receipt_email_status",
      sql`${t.status} in ('pending', 'sent', 'failed')`,
    ),
  ],
);

// One record per buyer per store. Consent is explicit: an unticked box never
// withdraws it, only the unsubscribe link does.
export const customer = pgTable(
  "customer",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => store.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name").notNull(),
    promoOptIn: boolean("promo_opt_in").notNull().default(false),
    optedInAt: timestamp("opted_in_at", { withTimezone: true }),
    optedOutAt: timestamp("opted_out_at", { withTimezone: true }),
    unsubscribeToken: text("unsubscribe_token").notNull().unique(),
    firstPurchaseAt: timestamp("first_purchase_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastPurchaseAt: timestamp("last_purchase_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    purchases: integer("purchases").notNull().default(1),
  },
  (t) => [
    unique("customer_store_email_key").on(t.storeId, t.email),
    index("customer_store_optin_idx")
      .on(t.storeId)
      .where(sql`${t.promoOptIn}`),
    check("customer_email_lower", sql`${t.email} = lower(${t.email})`),
  ],
);

export const VOID_REASON_MAX = 80;

// A whole sale taken back. The sale itself never changes; reads net it out.
// One row per sale, so a second void is a no-op, and there is no un-void.
export const saleVoid = pgTable(
  "sale_void",
  {
    saleId: uuid("sale_id")
      .primaryKey()
      .references(() => sale.id, { onDelete: "cascade" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => store.id, { onDelete: "cascade" }),
    // Whether the sold units went back on their listings.
    restocked: boolean("restocked").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("sale_void_reason", sql`char_length(${t.reason}) between 1 and 80`),
  ],
);

export const BUY_METHODS = ["cash", "card", "paypal", "trade"] as const;
export type BuyMethod = (typeof BUY_METHODS)[number];
export const SELLER_MAX = 40;

// Cards the vendor bought at the table. The id comes from the browser, so a
// second tap on the same form records nothing new. "trade" is store credit
// against a sale: no cash moves.
export const buy = pgTable(
  "buy",
  {
    id: uuid("id").primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => store.id, { onDelete: "cascade" }),
    method: text("method", { enum: BUY_METHODS }).notNull(),
    // First name or a note, never required.
    seller: text("seller"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("buy_store_created_idx").on(t.storeId, t.createdAt),
    check(
      "buy_method",
      sql`${t.method} in ('cash', 'card', 'paypal', 'trade')`,
    ),
    check("buy_seller", sql`char_length(${t.seller}) between 1 and 40`),
    check("buy_total_nonneg", sql`${t.total} >= 0`),
  ],
);

// listing_id is a plain uuid, like sale_line: history outlives the listing.
export const buyLine = pgTable(
  "buy_line",
  {
    buyId: uuid("buy_id")
      .notNull()
      .references(() => buy.id, { onDelete: "cascade" }),
    lineNo: smallint("line_no").notNull(),
    listingId: uuid("listing_id").notNull(),
    name: text("name").notNull(),
    qty: integer("qty").notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  },
  (t) => [
    primaryKey({ name: "buy_line_pk", columns: [t.buyId, t.lineNo] }),
    check("buy_line_qty_range", sql`${t.qty} between 1 and 999`),
    check("buy_line_price_positive", sql`${t.unitPrice} > 0`),
  ],
);

// The cash box for one stretch of selling: opened with the store (or from the
// dashboard), closed by a cash check. One open per store; it outlives pauses.
export const till = pgTable(
  "till",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => store.id, { onDelete: "cascade" }),
    openedAt: timestamp("opened_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Cash in the box at the start. Null when the vendor didn't say.
    openingFloat: numeric("opening_float", { precision: 12, scale: 2 }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    counted: numeric("counted", { precision: 12, scale: 2 }),
    // What the box should have held at close, kept so a later void can't move it.
    expected: numeric("expected", { precision: 12, scale: 2 }),
  },
  (t) => [
    uniqueIndex("till_open_key")
      .on(t.storeId)
      .where(sql`${t.closedAt} is null`),
    index("till_store_closed_idx").on(t.storeId, t.closedAt),
    check("till_float_nonneg", sql`${t.openingFloat} >= 0`),
    check("till_counted_nonneg", sql`${t.counted} >= 0`),
    check(
      "till_closed_fields",
      sql`(${t.closedAt} is null) = (${t.counted} is null) and (${t.counted} is null) = (${t.expected} is null)`,
    ),
  ],
);
