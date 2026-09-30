import "server-only";
import webpush, { type PushSubscription } from "web-push";

// Web Push (browsers + home-screen web apps), signed with VAPID keys.

let configured: boolean | undefined;

export function webPushConfigured(): boolean {
  if (configured !== undefined) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    console.warn("[push/web] VAPID keys not set — web push disabled");
    return (configured = false);
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:noreply@pointypoints.app",
    publicKey,
    privateKey,
  );
  return (configured = true);
}

export async function sendWebPush(
  sub: PushSubscription,
  payload: { title: string; body?: string; tag?: string; url?: string },
): Promise<{ ok: true } | { ok: false; gone: boolean; error: unknown }> {
  if (!webPushConfigured()) return { ok: false, gone: false, error: "NotConfigured" };
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload));
    return { ok: true };
  } catch (e) {
    const status = (e as { statusCode?: number })?.statusCode;
    // 404 / 410 = subscription expired or the user unsubscribed.
    return { ok: false, gone: status === 404 || status === 410, error: e };
  }
}
