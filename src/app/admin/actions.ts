"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { appUrl } from "@/lib/deployed";
import { createInvite, revokeInvite } from "@/lib/invites";
import { requireAdmin } from "@/lib/session";

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
