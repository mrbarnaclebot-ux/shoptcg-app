import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { vi } from "vitest";
import type { Db } from "@/db/open";
import * as schema from "@/db/schema";
import type {
  CatalogHit,
  PriceProvider,
  PriceRef,
} from "@/lib/pricing/provider";

/** In-memory PGlite with the real migrations, so DB constraints are exercised too. */
export async function migratedDb(): Promise<Db> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  return db as unknown as Db;
}

/** A user with a store; returns the store id. */
export async function addStore(db: Db, id: string) {
  await db.insert(schema.user).values({ id, name: "", email: `${id}@x.test` });
  const [row] = await db
    .insert(schema.store)
    .values({ ownerUserId: id, slug: `store-${id}`, name: id })
    .returning();
  return row.id;
}

export const hit = (over: Partial<CatalogHit> = {}): CatalogHit => ({
  provider: "fake",
  providerId: "sv03.5-199",
  kind: "raw",
  language: "en",
  name: "Charizard ex",
  setName: "151",
  number: "199",
  imageUrl: null,
  grader: null,
  grade: null,
  ...over,
});

export function fakeProvider(
  hits: CatalogHit[],
  price = 295.26,
): PriceProvider {
  return {
    name: "fake",
    search: vi.fn(async () => hits),
    getPrices: async <T extends PriceRef>(refs: T[]) =>
      refs.map((ref) => ({
        ref,
        marketUsd: price,
        lowUsd: null,
        highUsd: null,
        sampleSize: 3,
      })),
    getHistory: async () => [],
  };
}
