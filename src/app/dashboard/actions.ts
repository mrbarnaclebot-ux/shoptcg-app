"use server";

import { refresh } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { getAuth } from "@/lib/auth";
import { seedAllowed } from "@/lib/e2e-seed";
import { removePush } from "@/lib/push";
import { getCurrentUser, requireUser } from "@/lib/session";
import {
  createStore,
  setStoreState,
  SLUG_TAKEN,
  type FieldErrors,
} from "@/lib/stores";

export type CreateStoreState = { errors?: FieldErrors; taken?: string };

export async function createStoreAction(
  _prev: CreateStoreState,
  form: FormData,
): Promise<CreateStoreState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const result = await createStore(getDb(), user.id, {
    name: form.get("name"),
    slug: form.get("slug"),
  });
  if (!result.ok) {
    const slug = String(form.get("slug"));
    const taken = result.errors.slug === SLUG_TAKEN ? slug : undefined;
    return { errors: result.errors, taken };
  }
  // The dashboard plays the store-created moment once, then drops the flag.
  redirect("/dashboard?created=1");
}

export async function signOutAction(form: FormData) {
  const h = await headers();
  const endpoint = form.get("endpoint");
  const user = await getCurrentUser();
  // This device stops getting alerts; a failed delete never blocks sign-out.
  if (user && typeof endpoint === "string" && endpoint)
    await removePush(getDb(), user.id, endpoint).catch((err) =>
      console.error("[push] remove on sign-out failed", err),
    );
  await getAuth().api.signOut({ headers: h });
  redirect("/");
}

const stateInput = z.discriminatedUnion("state", [
  z.object({ state: z.literal("open") }),
  z.object({ state: z.literal("off") }),
  z.object({
    state: z.literal("paused"),
    minutes: z.union([z.literal(15), z.literal(60), z.null()]),
  }),
]);

/** e2e shortens a timed pause with a cookie; never honoured on a deployed service. */
async function pauseMs(minutes: number | null) {
  if (minutes === null) return null;
  if (seedAllowed(process.env)) {
    const ms = Number((await cookies()).get("e2e_pause_ms")?.value);
    if (ms > 0) return ms;
  }
  return minutes * 60_000;
}

/** The dashboard's store control. Returns an error the toast can show. */
export async function setStateAction(
  input: z.input<typeof stateInput>,
): Promise<{ error?: string }> {
  const user = await requireUser();
  const parsed = stateInput.safeParse(input);
  if (!parsed.success) return { error: "Pick open, pause or not vending." };
  const v = parsed.data;
  const ms = v.state === "paused" ? await pauseMs(v.minutes) : null;
  const ok = await setStoreState(getDb(), user.id, v.state, ms);
  if (!ok) return { error: "Create your store first." };
  refresh();
  return {};
}
