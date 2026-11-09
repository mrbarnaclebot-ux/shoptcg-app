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
    logoUrl: text("logo_url"),
    // What the vendor chose. What buyers get is storeState in src/lib/store-state.ts:
    // timers (auto-resume, auto-pause) are computed on read, never by a job.
    state: text("state", { enum: ["open", "paused", "off"] })
      .notNull()
      .default("paused"),
    // Deprecated: replaced by state. Kept one release so the previous deploy
    // keeps working while this one boots; dropped in the next migration.
    isOpen: boolean("is_open").notNull().default(false),
    // A timed pause resumes by itself once now() passes this.
    pausedUntil: timestamp("paused_until", { withTimezone: true }),
    // An open store pauses itself 14 hours after this, so nobody pings a vendor who went home.
    openedAt: timestamp("opened_at", { withTimezone: true }),
    priceRulePct: integer("price_rule_pct").notNull().default(0),
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
// slabs) described by the vendor. kind and language are copied from the
// catalog item so filters and the condition rule work the same for both.
export const listing = pgTable(
  "listing",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => store.id, { onDelete: "cascade" }),
    catalogItemId: uuid("catalog_item_id").references(() => catalogItem.id),
    kind: text("kind", { enum: ["raw", "graded", "sealed"] }).notNull(),
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
    check("listing_kind", sql`${t.kind} in ('raw', 'graded', 'sealed')`),
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
