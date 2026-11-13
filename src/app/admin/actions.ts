"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getDb } from "@/db";
import { appUrl } from "@/lib/deployed";
import {
  accountExists,
  closeInviteRequest,
  createInvite,
  createInviteFor,
  revokeInvite,
} from "@/lib/invites";
import { sendRequestDeclined } from "@/lib/email";
import { sendInviteLink } from "@/lib/sign-in-link";
import { dropImage } from "@/lib/image-store";
import { requireAdmin } from "@/lib/session";
import { setStoreImage, setSuspended } from "@/lib/stores";

export type CreateState = {
  code?: string;
  link?: string;
  emailed?: string;
  error?: string;
};

const emailSchema = z.email().max(254);

export async function createInviteAction(
  _prev: CreateState,
  form: FormData,
): Promise<CreateState> {
  await requireAdmin();
  const label = String(form.get("label") ?? "")
    .trim()
    .slice(0, 80);
  const typed = String(form.get("email") ?? "").trim();
  const parsed = typed ? emailSchema.safeParse(typed) : null;
  if (parsed && !parsed.success)
    return { error: "Enter a valid email address" };
  const email = parsed?.data.toLowerCase();
  const db = getDb();
  if (email && (await accountExists(db, email)))
    return { error: "That address already has an account." };
  const code = await (
    email
      ? createInviteFor(db, email, label || null)
      : createInvite(db, label || null)
  ).catch(() => null);
  if (!code) return { error: "Couldn't create the invite. Try again." };
  // With an address, the invite goes out now: their link sets up the account.
  if (email) sendInviteLink(email, await headers());
  refresh();
  return {
    code,
    link: new URL(`/join/${code}`, appUrl()).toString(),
    emailed: email,
  };
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

/** Answers a request from /join: invite emails them a setup link; dismiss doesn't. */
export async function answerRequestAction(id: string, invite: boolean) {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return false;
  const db = getDb();
  const req = await closeInviteRequest(
    db,
    id,
    invite ? "invited" : "dismissed",
  );
  if (!req) return false;
  if (invite && !(await accountExists(db, req.email))) {
    await createInviteFor(db, req.email, `Request: ${req.name}`.slice(0, 80));
    sendInviteLink(req.email, await headers());
  }
  if (!invite)
    after(() =>
      sendRequestDeclined(req.email).catch((err: unknown) =>
        console.error("[admin] decline email failed", (err as Error).name),
      ),
    );
  refresh();
  return true;
}
