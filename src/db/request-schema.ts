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
import { FULFIL, PAY_WITH } from "../lib/checkout";
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

// A timed claim sale at an online store (src/lib/claim-events.ts). Its status
// is computed on read from the clock, like storeState, so no job flips rows.
export const claimEvent = pgTable(
  "claim_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => store.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    // Set when the vendor ends it before endsAt.
    endedAt: timestamp("ended_at", { withTimezone: true }),
    // market: the store's normal price at claim time; custom: claim_event_item.price.
    priceMode: text("price_mode", { enum: ["market", "custom"] }).notNull(),
    allowUnclaim: boolean("allow_unclaim").notNull().default(false),
    // Claims stay held this long after the end, for the buyer to pay.
    payWithinHours: integer("pay_within_hours").notNull().default(24),
    maxPerBuyer: integer("max_per_buyer").notNull().default(5),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("claim_event_store_idx").on(t.storeId, t.endsAt),
    check(
      "claim_event_title_length",
      sql`char_length(${t.title}) between 1 and 80`,
    ),
    check(
      "claim_event_window",
      sql`${t.endsAt} > ${t.startsAt} and ${t.endsAt} <= ${t.startsAt} + interval '7 days'`,
    ),
    check(
      "claim_event_price_mode",
      sql`${t.priceMode} in ('market', 'custom')`,
    ),
    check("claim_event_pay_within", sql`${t.payWithinHours} between 1 and 168`),
    check("claim_event_max_per_buyer", sql`${t.maxPerBuyer} between 1 and 99`),
  ],
);

export type ClaimEvent = typeof claimEvent.$inferSelect;

export const claimEventItem = pgTable(
  "claim_event_item",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => claimEvent.id, { onDelete: "cascade" }),
    // deleteListing refuses while the event hasn't ended (claims would vanish);
    // after that the row can go with its listing.
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listing.id, { onDelete: "cascade" }),
    // Required in custom mode (checked in createEvent), unused in market mode.
    price: numeric("price", { precision: 12, scale: 2 }),
    maxPerBuyer: integer("max_per_buyer").notNull().default(1),
  },
  (t) => [
    primaryKey({
      name: "claim_event_item_pk",
      columns: [t.eventId, t.listingId],
    }),
    index("claim_event_item_listing_idx").on(t.listingId),
    check("claim_event_item_price_positive", sql`${t.price} > 0`),
    check("claim_event_item_max", sql`${t.maxPerBuyer} between 1 and 99`),
  ],
);

// The vendor's Block: this phone or email can't join the store's events again.
export const claimBlock = pgTable(
  "claim_block",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => store.id, { onDelete: "cascade" }),
    phone: text("phone"),
    email: text("email"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("claim_block_store_idx").on(t.storeId)],
);

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
    // The buyer's checkout picks at an online store; null when it offered none.
    // Phone and address are cleared 30 days on, sold or not (request-sweep.ts).
    fulfil: text("fulfil", { enum: FULFIL }),
    payWith: text("pay_with", { enum: PAY_WITH }),
    buyerPhone: text("buyer_phone"),
    deliveryAddress: text("delivery_address"),
    termsVersion: text("terms_version").notNull(),
    consentedAt: timestamp("consented_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    sessionId: text("session_id").notNull(),
    ipHash: text("ip_hash"),
    isTest: boolean("is_test").notNull().default(false),
    // Built by the vendor for a buyer standing at the table: no email, no
    // alert, and it can be sold while the store is paused.
    walkUp: boolean("walk_up").notNull().default(false),
    // Set on a buyer's claims in one claim event; one pending request each.
    claimEventId: uuid("claim_event_id").references(() => claimEvent.id),
    // The buyer's last claim, for the once-a-second limit.
    lastClaimAt: timestamp("last_claim_at", { withTimezone: true }),
    // Names of items the vendor removed from the store while they were on
    // this request, so the buyer's page can say so whenever it is opened.
    removedItems: text("removed_items")
      .array()
      .notNull()
      .default(sql`'{}'`),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    // Minutes the vendor added to a buyer's hold ("+15 min"); the check caps it.
    holdAddedMin: integer("hold_added_min").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (t) => [
    check("request_hold_added_min", sql`${t.holdAddedMin} between 0 and 60`),
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
    check(
      "request_fulfil",
      sql`${t.fulfil} is null or ${t.fulfil} in ('delivery', 'pickup')`,
    ),
    check(
      "request_pay_with",
      sql`${t.payWith} is null or ${t.payWith} in ('cash', 'transfer')`,
    ),
    check(
      "request_buyer_phone_length",
      sql`char_length(${t.buyerPhone}) <= 20`,
    ),
    check(
      "request_delivery_address_length",
      sql`char_length(${t.deliveryAddress}) <= 300`,
    ),
    // Codes only need to be told apart while a buyer is walking to the table.
    uniqueIndex("request_pending_code_idx")
      .on(t.storeId, t.code)
      .where(sql`${t.status} = 'pending'`),
    index("request_store_created_idx").on(t.storeId, t.createdAt.desc()),
    index("request_session_idx").on(t.sessionId, t.createdAt),
    index("request_ip_idx").on(t.ipHash, t.createdAt),
    // One joined buyer per phone, email and browser per event.
    ...(
      [
        ["request_claim_phone_idx", t.buyerPhone],
        ["request_claim_email_idx", t.buyerEmail],
        ["request_claim_session_idx", t.sessionId],
      ] as const
    ).map(([name, col]) =>
      uniqueIndex(name)
        .on(t.claimEventId, col)
        .where(sql`${t.claimEventId} is not null and ${t.status} = 'pending'`),
    ),
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
