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

// Auth tables follow the Better Auth core schema; column names must match it.
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

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
    isOpen: boolean("is_open").notNull().default(false),
    priceRulePct: integer("price_rule_pct").notNull().default(0),
    rounding: numeric("rounding").notNull().default("0"),
    secondCurrency: text("second_currency"),
    fxRate: numeric("fx_rate"),
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
    check("store_rounding_nonneg", sql`${t.rounding} >= 0`),
    check("store_fx_rate_positive", sql`${t.fxRate} > 0`),
    check(
      "store_second_currency_code",
      sql`${t.secondCurrency} ~ '^[A-Z]{3}$'`,
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
    // Bumped whenever a search returns the row; the nightly sync prices only recent ones.
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
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

export type CatalogItem = typeof catalogItem.$inferSelect;
export type NewCatalogItem = typeof catalogItem.$inferInsert;
