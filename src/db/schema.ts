import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export * from "./auth-schema";

export const store = pgTable(
  "store",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    // Vendor images, re-encoded by us (src/lib/store-image.ts). The file id is
    // the storage handle used to delete the old file on replace or removal.
    bannerUrl: text("banner_url"),
    bannerFileId: text("banner_file_id"),
    avatarUrl: text("avatar_url"),
    avatarFileId: text("avatar_file_id"),
    // What the vendor chose. What buyers get is storeState in src/lib/store-state.ts:
    // timers (auto-resume, auto-pause) are computed on read, never by a job.
    state: text("state", { enum: ["open", "paused", "off"] })
      .notNull()
      .default("paused"),
    // Set by an admin: the store reads as "off" until cleared, whatever the vendor chose.
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    // At a show table or an online store: the copy buyers see, hold length and
    // whether an open store pauses itself (src/lib/selling-mode.ts, store-state.ts).
    sellingMode: text("selling_mode", { enum: ["table", "online"] })
      .notNull()
      .default("table"),
    // Online checkout (src/lib/checkout.ts): what a buyer can pick at the cart.
    // All off means the old way: the vendor gets in touch to arrange both.
    offerDelivery: boolean("offer_delivery").notNull().default(false),
    offerPickup: boolean("offer_pickup").notNull().default(false),
    acceptCash: boolean("accept_cash").notNull().default(false),
    acceptTransfer: boolean("accept_transfer").notNull().default(false),
    // Free text so any country's details fit: bank, branch, name, number.
    bankDetails: text("bank_details"),
    // Shown at the cart: couriers, areas, fees, where pickup is.
    checkoutNote: text("checkout_note"),
    // Digits with the country code ("94771234567"): the buyer's order page links
    // to wa.me so they can send the transfer slip.
    whatsapp: text("whatsapp"),
    // Set when the vendor hides the getting-started tips, so they show once.
    tipsDismissedAt: timestamp("tips_dismissed_at", { withTimezone: true }),
    // A timed pause resumes by itself once now() passes this.
    pausedUntil: timestamp("paused_until", { withTimezone: true }),
    // An open store pauses itself 14 hours after this, so nobody pings a vendor who went home.
    openedAt: timestamp("opened_at", { withTimezone: true }),
    priceRulePct: integer("price_rule_pct").notNull().default(0),
    // A played raw card's market, as a percent of the Near Mint market
    // (src/lib/condition.ts). NM is always 100.
    condLpPct: integer("cond_lp_pct").notNull().default(85),
    condMpPct: integer("cond_mp_pct").notNull().default(70),
    condHpPct: integer("cond_hp_pct").notNull().default(55),
    condDmgPct: integer("cond_dmg_pct").notNull().default(40),
    rounding: numeric("rounding").notNull().default("0"),
    secondCurrency: text("second_currency"),
    fxRate: numeric("fx_rate"),
    // Shows "Or tap your phone here" on the table sign when the vendor has an NFC tag.
    nfcEnabled: boolean("nfc_enabled").notNull().default(false),
    // The organiser's table number ("B14"), shown on the store header and sign.
    tableLabel: text("table_label"),
    // Last receipt number used; its row lock serialises numbering per store.
    receiptSeq: integer("receipt_seq").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "store_slug_format",
      sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(${t.slug}) between 3 and 40`,
    ),
    check("store_name_length", sql`char_length(${t.name}) between 1 and 80`),
    check("store_rounding_step", sql`${t.rounding} in (0, 0.5, 1)`),
    check(
      "store_condition_pcts",
      sql`${t.condLpPct} between 1 and 100 and ${t.condMpPct} between 1 and 100 and ${t.condHpPct} between 1 and 100 and ${t.condDmgPct} between 1 and 100`,
    ),
    check(
      "store_bank_details_length",
      sql`char_length(${t.bankDetails}) <= 500`,
    ),
    check(
      "store_checkout_note_length",
      sql`char_length(${t.checkoutNote}) <= 300`,
    ),
    check("store_whatsapp_format", sql`${t.whatsapp} ~ '^[0-9]{8,15}$'`),
    check("store_price_rule_range", sql`${t.priceRulePct} between -90 and 500`),
    // A second currency is useless without the vendor rate, and vice versa.
    check(
      "store_fx_pair",
      sql`(${t.secondCurrency} is null) = (${t.fxRate} is null)`,
    ),
    check("store_fx_rate_positive", sql`${t.fxRate} > 0`),
    check(
      "store_second_currency_code",
      sql`${t.secondCurrency} ~ '^[A-Z]{3}$'`,
    ),
    check("store_state_valid", sql`${t.state} in ('open', 'paused', 'off')`),
    check(
      "store_selling_mode_valid",
      sql`${t.sellingMode} in ('table', 'online')`,
    ),
    check(
      "store_table_label_format",
      sql`${t.tableLabel} ~ '^[A-Za-z0-9-]{1,8}$'`,
    ),
  ],
);

export type Store = typeof store.$inferSelect;

// One sellable thing from a price provider. A graded slab is its own row so
// each grader + grade gets its own price history.
export const catalogItem = pgTable(
  "catalog_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    providerId: text("provider_id").notNull(),
    kind: text("kind", { enum: ["raw", "graded", "sealed"] }).notNull(),
    language: text("language", { enum: ["en", "ja", "zh"] }).notNull(),
    name: text("name").notNull(),
    setName: text("set_name").notNull(),
    number: text("number"),
    imageUrl: text("image_url"),
    grader: text("grader", { enum: ["PSA", "BGS", "CGC", "SGC"] }),
    grade: text("grade"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // NULLS NOT DISTINCT so raw and sealed rows (null grader) cannot duplicate.
    // Language is part of the key: one provider id may exist per language.
    unique("catalog_item_provider_key")
      .on(t.provider, t.providerId, t.language, t.grader, t.grade)
      .nullsNotDistinct(),
    check("catalog_item_kind", sql`${t.kind} in ('raw', 'graded', 'sealed')`),
    check("catalog_item_language", sql`${t.language} in ('en', 'ja', 'zh')`),
    check(
      "catalog_item_grader",
      sql`${t.grader} in ('PSA', 'BGS', 'CGC', 'SGC')`,
    ),
    check("catalog_item_grade", sql`${t.grade} ~ '^(10|[1-9](\\.5)?)$'`),
    check(
      "catalog_item_graded_fields",
      sql`(${t.kind} = 'graded') = (${t.grader} is not null and ${t.grade} is not null) and (${t.grader} is null) = (${t.grade} is null)`,
    ),
    // ponytail: prefix match only; add a pg_trgm GIN index if contains-search matters (PGlite needs the extension passed at construction).
    index("catalog_item_name_idx").on(
      t.kind,
      t.language,
      sql`lower(${t.name}) text_pattern_ops`,
    ),
  ],
);

// Daily snapshot per item and source: our own history, so provider history is
// paid for at most once.
export const pricePoint = pgTable(
  "price_point",
  {
    catalogItemId: uuid("catalog_item_id")
      .notNull()
      .references(() => catalogItem.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    marketUsd: numeric("market_usd", { precision: 12, scale: 2 }).notNull(),
    lowUsd: numeric("low_usd", { precision: 12, scale: 2 }),
    highUsd: numeric("high_usd", { precision: 12, scale: 2 }),
    sampleSize: integer("sample_size"),
    // Copies sold that day (raw: TCGplayer Near Mint; graded: eBay and
    // Fanatics at that grade). Null when the provider doesn't say.
    sales: integer("sales"),
    source: text("source").notNull(),
  },
  (t) => [
    primaryKey({
      name: "price_point_pk",
      columns: [t.catalogItemId, t.date, t.source],
    }),
    check("price_point_market_positive", sql`${t.marketUsd} > 0`),
    check("price_point_low_nonneg", sql`${t.lowUsd} >= 0`),
    check("price_point_high_nonneg", sql`${t.highUsd} >= 0`),
    check("price_point_sample_nonneg", sql`${t.sampleSize} >= 0`),
    check("price_point_sales_nonneg", sql`${t.sales} >= 0`),
  ],
);

// One row per catalog search that had to call the paid provider, for the per-user hourly limit.
export const searchMiss = pgTable(
  "search_miss",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("search_miss_user_at_idx").on(t.userId, t.at)],
);

// One row per magic-link send attempt that passed the limit, keyed "email:..." or "ip:...".
export const signInSend = pgTable(
  "sign_in_send",
  {
    key: text("key").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sign_in_send_key_at_idx").on(t.key, t.at)],
);

export type CatalogItem = typeof catalogItem.$inferSelect;
export type NewCatalogItem = typeof catalogItem.$inferInsert;

// One stock line in a store: a catalog item, or a custom item (CN cards, odd
// slabs, "other" things like sleeves or die-cast) described by the vendor. kind and language are copied from the
// catalog item so filters and the condition rule work the same for both.
export const listing = pgTable(
  "listing",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => store.id, { onDelete: "cascade" }),
    catalogItemId: uuid("catalog_item_id").references(() => catalogItem.id),
    kind: text("kind", {
      enum: ["raw", "graded", "sealed", "other"],
    }).notNull(),
    language: text("language", { enum: ["en", "ja", "zh"] }).notNull(),
    name: text("name"),
    setName: text("set_name"),
    number: text("number"),
    grader: text("grader"),
    grade: text("grade"),
    imageUrl: text("image_url"),
    condition: text("condition", { enum: ["NM", "LP", "MP", "HP", "DMG"] }),
    qty: integer("qty").notNull().default(1),
    overridePrice: numeric("override_price", { precision: 12, scale: 2 }),
    // What the vendor paid per unit. Private: it never reaches a buyer.
    cost: numeric("cost", { precision: 12, scale: 2 }),
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("listing_store_idx").on(t.storeId, t.createdAt),
    index("listing_catalog_item_idx").on(t.catalogItemId),
    check(
      "listing_kind",
      sql`${t.kind} in ('raw', 'graded', 'sealed', 'other')`,
    ),
    check("listing_language", sql`${t.language} in ('en', 'ja', 'zh')`),
    check(
      "listing_item_source",
      sql`${t.catalogItemId} is not null or char_length(trim(${t.name})) > 0`,
    ),
    check(
      "listing_condition",
      sql`${t.condition} in ('NM', 'LP', 'MP', 'HP', 'DMG')`,
    ),
    // Condition describes raw cards only; slabs carry a grade, sealed is sealed.
    check(
      "listing_condition_kind",
      sql`(${t.kind} = 'raw') = (${t.condition} is not null)`,
    ),
    check(
      "listing_custom_graded",
      sql`${t.catalogItemId} is not null or ${t.kind} <> 'graded' or (${t.grader} is not null and ${t.grade} is not null)`,
    ),
    check("listing_qty_nonneg", sql`${t.qty} >= 0`),
    check("listing_qty_max", sql`${t.qty} <= 9999`),
    check("listing_override_positive", sql`${t.overridePrice} > 0`),
    check("listing_cost_positive", sql`${t.cost} > 0`),
  ],
);

export const STOCK_REASONS = [
  "opening",
  "added",
  "adjusted",
  "sold",
  "voided",
  "bought",
] as const;

// Every change to a listing's quantity, written by the listing_stock_move
// trigger so no code path can skip it. The reason and ref come from
// transaction settings (see stockReason in src/lib/ledger.ts); without them a
// new listing is "added" and any other change is "adjusted".
export const stockMove = pgTable(
  "stock_move",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => store.id, { onDelete: "cascade" }),
    // A plain uuid, like sale_line: history outlives the listing.
    listingId: uuid("listing_id").notNull(),
    delta: integer("delta").notNull(),
    qtyAfter: integer("qty_after").notNull(),
    reason: text("reason", { enum: STOCK_REASONS }).notNull(),
    // The sale behind a "sold" or "voided" move, or the buy behind "bought".
    ref: uuid("ref"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("stock_move_store_at_idx").on(t.storeId, t.at.desc()),
    check(
      "stock_move_reason",
      sql`${t.reason} in ('opening', 'added', 'adjusted', 'sold', 'voided', 'bought')`,
    ),
  ],
);

export type Listing = typeof listing.$inferSelect;
export type NewListing = typeof listing.$inferInsert;

export * from "./request-schema";

export * from "./sale-schema";

// An admin's invite to become a vendor. Only the code's hash is kept.
export const invite = pgTable(
  "invite",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    codeHash: text("code_hash").notNull().unique(),
    label: text("label"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    reservedEmail: text("reserved_email"),
    usedAt: timestamp("used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    redeemedBy: text("redeemed_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("invite_reserved_email_idx").on(t.reservedEmail)],
);

// Someone asking for an invite from /join. The admin invites or dismisses it.
export const inviteRequest = pgTable(
  "invite_request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    // Where and how they sell, in their words.
    about: text("about"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    handledAt: timestamp("handled_at", { withTimezone: true }),
    outcome: text("outcome", { enum: ["invited", "dismissed"] }),
  },
  (t) => [
    // One open request per address: asking twice doesn't queue twice.
    uniqueIndex("invite_request_open_email_idx")
      .on(t.email)
      .where(sql`${t.handledAt} is null`),
    check(
      "invite_request_outcome_check",
      sql`${t.outcome} is null or ${t.outcome} in ('invited', 'dismissed')`,
    ),
  ],
);
