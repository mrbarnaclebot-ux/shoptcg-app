"use server";

import { z } from "zod";
import { getDb } from "@/db";
import { removeCustomer } from "@/lib/customers";
import { requireStore } from "@/lib/session";

/** False when it wasn't this store's, or is already gone. */
export async function removeCustomerAction(id: string) {
  const { store } = await requireStore();
  if (!z.uuid().safeParse(id).success) return false;
  return removeCustomer(getDb(), store.id, id);
}
