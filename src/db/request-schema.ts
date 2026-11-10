import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  pgView,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { listing, store } from "./schema";

export const REQUEST_STATUS = [
  "pending",
  "confirmed",
  "declined",
  "expired",
  "cancelled",
] as const;
export type RequestStatus = (typeof REQUEST_STATUS)[number];

// A buyer's "I'm interested" list. While pending and unexpired its lines hold
// stock (active_hold); release is a status change, so holds cannot orphan.
export const request = pgTable(
  "request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => store.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    status: text("status", { enum: REQUEST_STATUS })
      .notNull()
      .default("pending"),
    // Nullable: the 30-day purge clears buyer details on unsold requests.
    buyerName: text("buyer_name"),
    buyerEmail: text("buyer_email"),
    promoOptIn: boolean("promo_opt_in").notNull().default(false),
    termsVersion: text("terms_version").notNull(),
    consentedAt: timestamp("consented_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    sessionId: text("session_id").notNull(),
    ipHash: text("ip_hash"),
    isTest: boolean("is_test").notNull().default(false),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (t) => [
    check(
      "request_status",
      sql`${t.status} in ('pending', 'confirmed', 'declined', 'expired', 'cancelled')`,
    ),
    check("request_code_format", sql`${t.code} ~ '^[2-9A-HJKMNP-TV-Z]{4}$'`),
    check(
      "request_buyer_name_length",
      sql`char_length(${t.buyerName}) between 1 and 80`,
    ),
    check(
      "request_buyer_email_format",
      sql`char_length(${t.buyerEmail}) <= 254 and ${t.buyerEmail} = lower(${t.buyerEmail})`,
    ),
    check("request_expiry_after_create", sql`${t.expiresAt} > ${t.createdAt}`),
    // Codes only need to be told apart while a buyer is walking to the table.
    uniqueIndex("request_pending_code_idx")
      .on(t.storeId, t.code)
      .where(sql`${t.status} = 'pending'`),
    index("request_store_created_idx").on(t.storeId, t.createdAt.desc()),
    index("request_session_idx").on(t.sessionId, t.createdAt),
    index("request_ip_idx").on(t.ipHash, t.createdAt),
    index("request_pending_expiry_idx")
      .on(t.expiresAt)
      .where(sql`${t.status} = 'pending'`),
  ],
);

export type Request = typeof request.$inferSelect;

export const requestLine = pgTable(
  "request_line",
  {
    requestId: uuid("request_id")
      .notNull()
      .references(() => request.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listing.id, { onDelete: "cascade" }),
    qty: integer("qty").notNull(),
    quotedPrice: numeric("quoted_price", { precision: 12, scale: 2 }).notNull(),
  },
  (t) => [
    primaryKey({
      name: "request_line_pk",
      columns: [t.requestId, t.listingId],
    }),
    index("request_line_listing_idx").on(t.listingId),
    check("request_line_qty_range", sql`${t.qty} between 1 and 99`),
    check("request_line_price_nonneg", sql`${t.quotedPrice} >= 0`),
  ],
);

// Units held right now. now() is the transaction start, so one transaction
// sees a consistent set of holds.
export const activeHold = pgView("active_hold", {
  listingId: uuid("listing_id").notNull(),
  requestId: uuid("request_id").notNull(),
  storeId: uuid("store_id").notNull(),
  qty: integer("qty").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}).as(
  sql`select rl.listing_id, rl.request_id, r.store_id, rl.qty, r.expires_at from request_line rl join request r on r.id = rl.request_id where r.status = 'pending' and r.expires_at > now()`,
);

// One row per stay on a store's pages: a device seen again within 30 minutes
// extends its row, later it starts a new one. device_id is a random id the
// buyer's browser keeps for this store only; no IP, since a venue shares one.
export const visit = pgTable(
  "visit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => store.id, { onDelete: "cascade" }),
    deviceId: text("device_id").notNull(),
    firstSeen: timestamp("first_seen", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeen: timestamp("last_seen", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("visit_store_seen_idx").on(t.storeId, t.lastSeen),
    index("visit_store_device_idx").on(t.storeId, t.deviceId, t.lastSeen),
  ],
);

export type BasketLine = { id: string; qty: number };

// A buyer's list before they send it, mirrored from their browser so the
// vendor can see who is building what. It holds no stock and names nobody.
export const basket = pgTable(
  "basket",
  {
    storeId: uuid("store_id")
      .notNull()
      .references(() => store.id, { onDelete: "cascade" }),
    deviceId: text("device_id").notNull(),
    lines: jsonb("lines").$type<BasketLine[]>().notNull(),
    seenAt: timestamp("seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: "basket_pk", columns: [t.storeId, t.deviceId] }),
    index("basket_store_seen_idx").on(t.storeId, t.seenAt),
  ],
);

// One row per browser that allowed request alerts; the endpoint is the identity.
export const pushSubscription = pgTable("push_subscription", {
  endpoint: text("endpoint").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
