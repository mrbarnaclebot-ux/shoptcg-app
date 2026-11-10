"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { appUrl } from "@/lib/deployed";
import { createInvite, revokeInvite } from "@/lib/invites";
import { dropImage } from "@/lib/image-store";
import { requireAdmin } from "@/lib/session";
import { setStoreImage, setSuspended } from "@/lib/stores";

export type CreateState = { code?: string; link?: string; error?: string };

export async function createInviteAction(
  _prev: CreateState,
  form: FormData,
): Promise<CreateState> {
  await requireAdmin();
  const label = String(form.get("label") ?? "")
    .trim()
    .slice(0, 80);
  const code = await createInvite(getDb(), label || null).catch(() => null);
  if (!code) return { error: "Couldn't create the invite. Try again." };
  refresh();
  return { code, link: new URL(`/join/${code}`, appUrl()).toString() };
}

export async function revokeInviteAction(id: string) {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return false;
  const done = await revokeInvite(getDb(), id);
  refresh();
  return done;
}

/** Stops a vendor's store (it reads as not vending) or lets it run again. */
export async function suspendStoreAction(storeId: string, on: boolean) {
  await requireAdmin();
  if (!z.uuid().safeParse(storeId).success) return false;
  const done = await setSuspended(getDb(), storeId, on === true);
  refresh();
  return done;
}

/** Takes down a vendor's banner and profile image. */
export async function removeStoreImagesAction(storeId: string) {
  await requireAdmin();
  if (!z.uuid().safeParse(storeId).success) return false;
  for (const kind of ["banner", "avatar"] as const)
    await dropImage(await setStoreImage(getDb(), storeId, kind, null));
  refresh();
  return true;
}
