import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/open";
import {
  buy,
  buyLine,
  BUY_METHODS,
  catalogItem,
  listing,
  SELLER_MAX,
  store,
} from "@/db/schema";
import { stockReason } from "@/lib/ledger";
import {
  catalogListingSchema,
  customListingSchema,
  priceSchema,
} from "@/lib/listing-input";
import {
  addCustomListing,
  blendCost,
  catalogCard,
  stockCatalogCard,
} from "@/lib/listings";
import { fromCents, toCents } from "@/lib/money";
import { localDate } from "@/lib/reports";

const qty = z.coerce
  .number({ error: "Enter a whole number" })
  .int("Enter a whole number")
  .min(1, "At least 1")
  .max(999);
const paid = priceSchema
  .refine((v) => v !== null, "Enter what you paid")
  .transform((v) => v!);

export const buyInput = z
  .object({
    /** Made by the form, so a second tap of the same buy records nothing. */
    id: z.uuid(),
    method: z.enum(BUY_METHODS),
    seller: z
      .string()
      .trim()
      .max(SELLER_MAX)
      .transform((v) => v || null)
      .nullish(),
    lines: z
      .array(
        z.union([
          z.object({ listingId: z.uuid(), qty, unitPrice: paid }),
          // A new item: a custom listing made with the bought units.
          z.object({ item: customListingSchema, qty, unitPrice: paid }),
          // A catalog card: it tops up the store's row of that card and
          // condition, or makes one (the add rule).
          catalogListingSchema
            .pick({
              catalogItemId: true,
              condition: true,
              grader: true,
              grade: true,
            })
            .extend({ qty, unitPrice: paid }),
        ]),
      )
      .min(1, "Add what you bought")
      .max(50),
  })
  .refine((v) => {
    const ids = v.lines.flatMap((l) => ("listingId" in l ? [l.listingId] : []));
    return new Set(ids).size === ids.length;
  }, "Each item once");

export type BuyInput = z.infer<typeof buyInput>;

export type BuyResult =
  | {
      ok: true;
      buyId: string;
      total: string;
      already?: true;
      /** Catalog cards that got a new listing, to price. */
      added?: string[];
    }
  /** A listing isn't this store's (or is gone); nothing changed. */
  | { gone: true }
  /** These listings would pass 9999 units; nothing changed. */
  | { full: string[] };

/**
 * Records cards bought at the table: the buy, its lines and the stock, in one
 * transaction, labelled "bought" in the ledger. The price paid becomes the
 * listing's cost: averaged with what the units on hand cost when that is known,
 * otherwise it replaces it. A catalog card follows the add rule
 * (stockCatalogCard). Safe to repeat: the same id returns the first buy.
 */
export async function recordBuy(
  db: Db,
  storeId: string,
  input: BuyInput,
): Promise<BuyResult> {
  // Outside the lock: a picked grade makes its graded catalog row.
  const cards = await Promise.all(
    input.lines.map((l) =>
      "catalogItemId" in l
        ? catalogCard(db, {
            ...l,
            cost: l.unitPrice,
            overridePrice: null,
          })
        : null,
    ),
  );
  return db.transaction(async (t) => {
    const tx = t as Db;
    // Same lock order as a sale (store, then listings by id), so they never deadlock.
    const [s] = await tx
      .select({ id: store.id })
      .from(store)
      .where(eq(store.id, storeId))
      .for("no key update");
    if (!s) return { gone: true };
    const [done] = await tx
      .select({ storeId: buy.storeId, total: buy.total })
      .from(buy)
      .where(eq(buy.id, input.id));
    if (done)
      return done.storeId === storeId
        ? { ok: true, buyId: input.id, total: done.total, already: true }
        : { gone: true };

    const ids = input.lines.flatMap((l) =>
      "listingId" in l ? [l.listingId] : [],
    );
    const have = ids.length
      ? await tx
          .select({ id: listing.id, qty: listing.qty })
          .from(listing)
          .where(
            and(
              inArray(listing.id, ids),
              eq(listing.storeId, storeId),
              isNull(listing.removedAt),
            ),
          )
          .orderBy(listing.id)
          .for("update")
      : [];
    if (have.length !== ids.length) return { gone: true };
    const onHand = new Map(have.map((h) => [h.id, h.qty]));
    const full = input.lines.flatMap((l) =>
      "listingId" in l && onHand.get(l.listingId)! + l.qty > 9999
        ? [l.listingId]
        : [],
    );
    if (full.length) return { full };
    const names = new Map(
      ids.length
        ? (
            await tx
              .select({
                id: listing.id,
                name: sql<string>`coalesce(${listing.name}, ${catalogItem.name})`,
              })
              .from(listing)
              .leftJoin(catalogItem, eq(catalogItem.id, listing.catalogItemId))
              .where(inArray(listing.id, ids))
          ).map((r) => [r.id, r.name])
        : [],
    );

    const total = fromCents(
      input.lines.reduce((sum, l) => sum + toCents(l.unitPrice) * l.qty, 0),
    );
    await tx.insert(buy).values({
      id: input.id,
      storeId,
      method: input.method,
      seller: input.seller ?? null,
      total,
    });
    await stockReason(tx, "bought", input.id);
    const lines = [];
    const added = [];
    for (const [i, l] of input.lines.entries()) {
      let listingId: string;
      let name: string;
      if ("listingId" in l) {
        ({ listingId } = l);
        name = names.get(listingId)!;
        await tx
          .update(listing)
          .set({
            cost: blendCost(l.qty, l.unitPrice),
            qty: sql`${listing.qty} + ${l.qty}`,
            updatedAt: sql`now()`,
          })
          .where(eq(listing.id, listingId));
      } else if ("item" in l) {
        const row = await addCustomListing(tx, storeId, {
          ...l.item,
          qty: l.qty,
          cost: l.unitPrice,
        });
        listingId = row.id;
        name = l.item.name;
      } else {
        const card = cards[i]!;
        const row = await stockCatalogCard(tx, storeId, card);
        if (!row.merged) added.push(row.catalogItemId!);
        listingId = row.id;
        name = card.name;
      }
      lines.push({
        buyId: input.id,
        lineNo: i + 1,
        listingId,
        name,
        qty: l.qty,
        unitPrice: l.unitPrice,
      });
    }
    await tx.insert(buyLine).values(lines);
    return { ok: true, buyId: input.id, total, added };
  });
}

/** One row per bought line, for the buys export; the buy's total is on its first line only. */
export async function buyCsvRows(
  db: Db,
  storeId: string,
  r: { from: string; to: string },
  timeZone: string,
) {
  const time = new Intl.DateTimeFormat("en-US", {
    timeStyle: "short",
    timeZone,
  });
  return [
    [
      "date",
      "time",
      "item",
      "qty",
      "unit_paid",
      "line_total",
      "buy_total",
      "method",
      "seller",
    ],
    ...(await buysIn(db, storeId, r, timeZone)).flatMap((b) =>
      b.lines.map((l, i) => [
        localDate(b.createdAt, timeZone),
        time.format(b.createdAt),
        l.name,
        l.qty,
        l.unitPrice,
        fromCents(toCents(l.unitPrice) * l.qty),
        i === 0 ? b.total : null,
        b.method,
        i === 0 ? b.seller : null,
      ]),
    ),
  ];
}

/** Buys made in a range of days on this zone's calendar, oldest first, with their lines. */
export async function buysIn(
  db: Db,
  storeId: string,
  r: { from: string; to: string },
  timeZone: string,
) {
  const rows = await db
    .select({ buy, line: buyLine })
    .from(buy)
    .innerJoin(buyLine, eq(buyLine.buyId, buy.id))
    .where(
      and(
        eq(buy.storeId, storeId),
        sql`${buy.createdAt} >= (${r.from}::date)::timestamp at time zone ${timeZone}`,
        sql`${buy.createdAt} < (${r.to}::date + 1)::timestamp at time zone ${timeZone}`,
      ),
    )
    .orderBy(asc(buy.createdAt), asc(buy.id), asc(buyLine.lineNo));
  return [...Map.groupBy(rows, (x) => x.buy.id).values()].map((g) => ({
    ...g[0].buy,
    lines: g.map((x) => x.line),
  }));
}
