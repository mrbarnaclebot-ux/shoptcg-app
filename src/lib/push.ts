import { and, desc, eq, inArray } from "drizzle-orm";
import webpush from "web-push";
import type { Db } from "@/db/open";
import { pushSubscription, store } from "@/db/schema";
import { usd } from "@/lib/format";
import { shortName } from "@/lib/requests";

// Web Push is additive to SSE: it reaches a backgrounded or locked phone
// (iOS only once the dashboard is installed to the home screen).

type Env = Record<string, string | undefined>;

export const MAX_PUSH_DEVICES = 10;

/** Upserts a browser's endpoint and keeps a vendor's newest devices only. */
export async function savePush(
  db: Db,
  row: typeof pushSubscription.$inferInsert,
) {
  await db
    .insert(pushSubscription)
    .values(row)
    // Dashboards re-save on load, so the date means "last seen".
    .onConflictDoUpdate({
      target: pushSubscription.endpoint,
      set: { ...row, createdAt: new Date() },
    });
  await db
    .delete(pushSubscription)
    .where(
      and(
        eq(pushSubscription.userId, row.userId),
        inArray(
          pushSubscription.endpoint,
          db
            .select({ endpoint: pushSubscription.endpoint })
            .from(pushSubscription)
            .where(eq(pushSubscription.userId, row.userId))
            .orderBy(
              desc(pushSubscription.createdAt),
              pushSubscription.endpoint,
            )
            .offset(MAX_PUSH_DEVICES),
        ),
      ),
    );
}

/** VAPID settings, or null when push is off (dev, e2e). */
export function vapid(env: Env = process.env) {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) return null;
  return {
    publicKey: VAPID_PUBLIC_KEY,
    privateKey: VAPID_PRIVATE_KEY,
    subject: VAPID_SUBJECT,
  };
}

export type PushMessage = {
  title: string;
  body: string;
  tag: string;
  url: string;
};
type Sub = { endpoint: string; p256dh: string; auth: string };
export type Sender = (sub: Sub, payload: string) => Promise<unknown>;

function webPushSender(): Sender | null {
  const v = vapid();
  if (!v) return null;
  return (sub, payload) =>
    webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload,
      {
        TTL: 900,
        urgency: "high",
        vapidDetails: v,
      },
    );
}

/** Sends to every browser the user allowed; gone subscriptions (404/410) are deleted. */
export async function pushToUser(
  db: Db,
  userId: string,
  msg: PushMessage,
  send: Sender | null = webPushSender(),
) {
  if (!send) return;
  const subs = await db
    .select()
    .from(pushSubscription)
    .where(eq(pushSubscription.userId, userId));
  const gone: string[] = [];
  await Promise.all(
    subs.map((s) =>
      send(s, JSON.stringify(msg)).catch((err: { statusCode?: number }) => {
        if (err.statusCode === 404 || err.statusCode === 410)
          gone.push(s.endpoint);
        else console.error("[push] send failed", err.statusCode);
      }),
    ),
  );
  if (gone.length)
    await db
      .delete(pushSubscription)
      .where(inArray(pushSubscription.endpoint, gone));
}

/** "New request: Maya R." to the store owner. No email in the payload. */
export async function pushNewRequest(
  db: Db,
  storeId: string,
  r: { id: string; name: string; items: number; total: number },
  send?: Sender | null,
) {
  const [s] = await db
    .select({ userId: store.ownerUserId })
    .from(store)
    .where(eq(store.id, storeId));
  if (!s) return;
  await pushToUser(
    db,
    s.userId,
    {
      title: `New request: ${shortName(r.name)}`,
      body: `${r.items} ${r.items === 1 ? "item" : "items"}, ${usd(r.total)}. Hold ends in 15 min.`,
      tag: r.id,
      url: `/dashboard?r=${r.id}`,
    },
    send,
  );
}
