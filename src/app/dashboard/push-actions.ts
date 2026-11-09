"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { pushSubscription } from "@/db/schema";
import { pushToUser } from "@/lib/push";
import { requireUser } from "@/lib/session";

const key = z
  .string()
  .regex(/^[A-Za-z0-9_-]+=*$/)
  .max(200);
// Browser push services only: the server POSTs to this URL on "Test alert".
const PUSH_HOST =
  /^(fcm\.googleapis\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|([a-z0-9-]+\.)*notify\.windows\.com)$/;
const subSchema = z.object({
  endpoint: z.url({ protocol: /^https$/, hostname: PUSH_HOST }).max(2048),
  keys: z.object({ p256dh: key, auth: key }),
});

/** Stores this browser's push endpoint for the signed-in vendor (re-owned if it moved). */
export async function savePushSubscription(sub: unknown) {
  const user = await requireUser();
  const parsed = subSchema.safeParse(sub);
  if (!parsed.success) return false;
  const row = {
    endpoint: parsed.data.endpoint,
    userId: user.id,
    ...parsed.data.keys,
  };
  await getDb()
    .insert(pushSubscription)
    .values(row)
    .onConflictDoUpdate({ target: pushSubscription.endpoint, set: row });
  return true;
}

export async function removePushSubscription(endpoint: string) {
  const user = await requireUser();
  await getDb()
    .delete(pushSubscription)
    .where(
      and(
        eq(pushSubscription.endpoint, endpoint),
        eq(pushSubscription.userId, user.id),
      ),
    );
}

/** "Test alert": the same path a real request takes, to this vendor's own browsers. */
export async function sendTestPush() {
  const user = await requireUser();
  await pushToUser(getDb(), user.id, {
    title: "Test alert",
    body: "Requests will look like this when your phone is locked.",
    tag: "test",
    url: "/dashboard",
  });
}
