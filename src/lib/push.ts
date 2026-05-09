import "server-only";
import webpush, { type PushSubscription as WebPushSubscription } from "web-push";
import { supabaseAdmin } from "@/lib/supabase/server";

let configured = false;

function configure() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:noreply@pointypoints.app";
  if (!publicKey || !privateKey) {
    throw new Error("Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY.");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export type PushPayload = {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
};

// Fetch every registered subscription with the given role and fan out a
// push notification to each. Failures (404 / 410 = expired/unsubscribed)
// prune the dead row from the table.
export async function sendPushToRole(
  role: "parent" | "kid",
  payload: PushPayload,
): Promise<void> {
  configure();

  const { data, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("role", role);
  if (error) {
    console.error("[push] failed to load subscriptions", error);
    return;
  }
  if (!data || data.length === 0) return;

  const json = JSON.stringify(payload);

  await Promise.all(
    data.map(async (row) => {
      const sub: WebPushSubscription = {
        endpoint: row.endpoint as string,
        keys: { p256dh: row.p256dh as string, auth: row.auth as string },
      };
      try {
        await webpush.sendNotification(sub, json);
      } catch (e: unknown) {
        const status = (e as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          // Subscription expired — clean it out.
          await supabaseAdmin
            .from("push_subscriptions")
            .delete()
            .eq("id", row.id as string);
        } else {
          console.error("[push] send failed", status, e);
        }
      }
    }),
  );
}
