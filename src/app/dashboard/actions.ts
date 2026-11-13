"use server";

import { refresh } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { getAuth } from "@/lib/auth";
import { seedAllowed } from "@/lib/e2e-seed";
import { removePush } from "@/lib/push";
import { getCurrentUser, requireStore, requireUser } from "@/lib/session";
import {
  createStore,
  dismissTips,
  getStoreByOwner,
  setStoreState,
  SLUG_TAKEN,
  type FieldErrors,
} from "@/lib/stores";
import { cashSchema, closeTill, openTill, setFloat } from "@/lib/till";

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

/** The getting-started tips' "Hide tips": they never come back. */
export async function dismissTipsAction() {
  const user = await requireUser();
  await dismissTips(getDb(), user.id);
  refresh();
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
  const store = await getStoreByOwner(getDb(), user.id);
  if (store?.suspendedAt) return { error: "An admin has stopped this store." };
  const ok = await setStoreState(getDb(), user.id, v.state, ms);
  if (!ok || !store) return { error: "Create your store first." };
  // Opening starts a cash box; one already open (across a pause) carries on.
  if (v.state === "open") await openTill(getDb(), store.id);
  refresh();
  return {};
}

const GONE = "That cash box is closed. Reload the page.";
const optionalCash = z.preprocess(
  (v) => (typeof v === "string" && !v.trim() ? null : v),
  cashSchema.nullable(),
);

/** Sets the open cash box's float, starting a box if none is open. */
export async function setFloatAction(
  amount: string,
): Promise<{ error?: string }> {
  const { store } = await requireStore();
  const v = optionalCash.safeParse(amount);
  if (!v.success) return { error: v.error.issues[0].message };
  await setFloat(getDb(), store.id, v.data);
  refresh();
  return {};
}

/** The cash check at close: counted against expected, and the box closes. */
export async function cashCheckAction(
  tillId: string,
  counted: string,
): Promise<{ error?: string; expected?: string; counted?: string }> {
  const { store } = await requireStore();
  const v = cashSchema.safeParse(counted);
  if (!v.success) return { error: v.error.issues[0].message };
  const id = z.uuid().safeParse(tillId);
  if (!id.success) return { error: GONE };
  const r = await closeTill(getDb(), store.id, id.data, v.data);
  if (!("ok" in r)) return { error: GONE };
  refresh();
  return { expected: r.expected, counted: r.counted };
}
