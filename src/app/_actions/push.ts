"use server";

import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import {
  getCurrentUser,
  getKidSession,
  requireHouseholdAccess,
} from "@/lib/v2/auth";
import { registerDevice, unregisterDevice, type DeviceOwner } from "@/lib/v2/push";

type Result = { ok: true } | { ok: false; error: string };

// Resolve who this browser belongs to: the signed-in kid (cookie) for the
// kid view, or the signed-in parent for the parent view.
async function ownerFor(
  slug: string,
  role: "parent" | "kid",
): Promise<DeviceOwner | null> {
  if (role === "parent") {
    const household = await requireHouseholdAccess(slug);
    const user = await getCurrentUser();
    return user ? { role, householdId: household.id, userId: user.id } : null;
  }

  const session = await getKidSession();
  if (!session) return null;
  const { data: household } = await supabaseV2Admin
    .from("households")
    .select("id, slug")
    .eq("id", session.householdId)
    .maybeSingle();
  if (!household || household.slug !== slug) return null;
  return { role, householdId: session.householdId, kidProfileId: session.kidProfileId };
}

// Register a browser PushSubscription (the JSON PushManager.subscribe hands
// back) for this household's parent or kid.
export async function registerWebPushAction(
  slug: string,
  role: "parent" | "kid",
  subscriptionJson: string,
  userAgent: string | null,
): Promise<Result> {
  let parsed: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    parsed = JSON.parse(subscriptionJson);
  } catch {
    return { ok: false, error: "Invalid subscription payload." };
  }
  const { endpoint } = parsed;
  const p256dh = parsed.keys?.p256dh;
  const auth = parsed.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return { ok: false, error: "Missing endpoint/keys." };
  }
  if (role !== "parent" && role !== "kid") return { ok: false, error: "Bad role." };

  const owner = await ownerFor(slug, role);
  if (!owner) return { ok: false, error: "Sign in first." };

  return registerDevice(owner, { platform: "web", endpoint, p256dh, auth }, userAgent);
}

export async function unregisterWebPushAction(
  slug: string,
  role: "parent" | "kid",
  endpoint: string,
): Promise<Result> {
  if (!endpoint) return { ok: false, error: "Missing endpoint." };
  const owner = await ownerFor(slug, role);
  if (!owner) return { ok: false, error: "Sign in first." };
  await unregisterDevice(owner.householdId, endpoint);
  return { ok: true };
}
