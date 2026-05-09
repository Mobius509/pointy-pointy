"use server";

import { supabaseAdmin } from "@/lib/supabase/server";

// Register a browser PushSubscription (the JSON the browser hands you back
// from PushManager.subscribe) with this household. role distinguishes
// parent devices (notified on submit) from kid devices (notified on approve).
export async function registerPushSubscriptionAction(
  role: "parent" | "kid",
  subscriptionJson: string,
  userAgent: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let parsed: {
    endpoint: string;
    keys?: { p256dh?: string; auth?: string };
  };
  try {
    parsed = JSON.parse(subscriptionJson);
  } catch {
    return { ok: false, error: "Invalid subscription payload." };
  }
  const endpoint = parsed?.endpoint;
  const p256dh = parsed?.keys?.p256dh;
  const auth = parsed?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return { ok: false, error: "Missing endpoint/keys." };
  }
  if (role !== "parent" && role !== "kid") {
    return { ok: false, error: "Bad role." };
  }

  // Upsert: re-subscribing the same browser should refresh, not duplicate.
  const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
    {
      endpoint,
      p256dh,
      auth,
      role,
      user_agent: userAgent,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}

export async function unregisterPushSubscriptionAction(
  endpoint: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!endpoint) return { ok: false, error: "Missing endpoint." };
  const { error } = await supabaseAdmin
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
