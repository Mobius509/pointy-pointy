import "server-only";
import { after } from "next/server";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { sendApns, type ApnsEnv } from "./apns";
import { sendWebPush } from "./web";

// Push notifications for v2. One device registry (v2.push_devices) covering
// browsers (Web Push) and the iOS app (APNs); `deliver` fans a payload out
// to every matching device over the right transport and prunes dead ones.
//
// Event helpers (notifyTaskSubmitted, …) schedule delivery with `after()` so
// the user's action returns immediately and a push failure never fails it.

export type PushPayload = {
  title: string;
  body?: string;
  tag?: string;
  url?: string;
};

type DeviceRow = {
  id: string;
  platform: "web" | "ios";
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
  apns_env: ApnsEnv | null;
};

// ============================================================================
// Registry
// ============================================================================

export type DeviceOwner =
  | { role: "parent"; householdId: string; userId: string }
  | { role: "kid"; householdId: string; kidProfileId: string };

export type DeviceRegistration =
  | { platform: "web"; endpoint: string; p256dh: string; auth: string }
  | { platform: "ios"; token: string; apnsEnv: ApnsEnv };

// Upsert on endpoint: the same browser/phone re-registering (or switching
// from one kid to another) moves the row rather than duplicating it.
export async function registerDevice(
  owner: DeviceOwner,
  device: DeviceRegistration,
  userAgent: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabaseV2Admin.from("push_devices").upsert(
    {
      household_id: owner.householdId,
      role: owner.role,
      user_id: owner.role === "parent" ? owner.userId : null,
      kid_profile_id: owner.role === "kid" ? owner.kidProfileId : null,
      platform: device.platform,
      endpoint: device.platform === "web" ? device.endpoint : device.token,
      p256dh: device.platform === "web" ? device.p256dh : null,
      auth: device.platform === "web" ? device.auth : null,
      apns_env: device.platform === "ios" ? device.apnsEnv : null,
      user_agent: userAgent,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Scoped to the household so one family can't delete another's devices.
export async function unregisterDevice(
  householdId: string,
  endpoint: string,
): Promise<void> {
  await supabaseV2Admin
    .from("push_devices")
    .delete()
    .eq("household_id", householdId)
    .eq("endpoint", endpoint);
}

// ============================================================================
// Delivery
// ============================================================================

// Returns how many devices the push service accepted the notification for.
async function deliver(devices: DeviceRow[], payload: PushPayload): Promise<number> {
  const dead: string[] = [];
  let delivered = 0;
  await Promise.all(
    devices.map(async (d) => {
      if (d.platform === "web" && d.p256dh && d.auth) {
        const res = await sendWebPush(
          { endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } },
          payload,
        );
        if (res.ok) delivered++;
        else if (res.gone) dead.push(d.id);
        else console.error("[push/web] send failed", res.error);
      } else if (d.platform === "ios" && d.apns_env) {
        const res = await sendApns(d.endpoint, d.apns_env, payload);
        if (res.ok) delivered++;
        else if (res.gone) dead.push(d.id);
        else if (res.reason !== "NotConfigured") {
          console.error("[push/apns] send failed", res.status, res.reason);
        }
      }
    }),
  );
  if (dead.length > 0) {
    await supabaseV2Admin.from("push_devices").delete().in("id", dead);
  }
  return delivered;
}

const DEVICE_COLUMNS = "id, platform, endpoint, p256dh, auth, apns_env";

async function householdSlug(householdId: string): Promise<string | null> {
  const { data } = await supabaseV2Admin
    .from("households")
    .select("slug")
    .eq("id", householdId)
    .maybeSingle();
  return (data?.slug as string | undefined) ?? null;
}

async function kidName(kidProfileId: string): Promise<string> {
  const { data } = await supabaseV2Admin
    .from("kid_profiles")
    .select("name")
    .eq("id", kidProfileId)
    .maybeSingle();
  return (data?.name as string | undefined) ?? "Your kid";
}

export async function notifyParents(
  householdId: string,
  payload: PushPayload,
): Promise<number> {
  const { data, error } = await supabaseV2Admin
    .from("push_devices")
    .select(DEVICE_COLUMNS)
    .eq("household_id", householdId)
    .eq("role", "parent");
  if (error) {
    console.error("[push] load parent devices failed", error);
    return 0;
  }
  if (!data?.length) return 0;

  const slug = await householdSlug(householdId);
  return deliver(data as DeviceRow[], {
    url: slug ? `/h/${slug}/parent` : undefined,
    ...payload,
  });
}

export async function notifyKid(
  householdId: string,
  kidProfileId: string,
  payload: PushPayload,
): Promise<number> {
  const { data, error } = await supabaseV2Admin
    .from("push_devices")
    .select(DEVICE_COLUMNS)
    .eq("household_id", householdId)
    .eq("kid_profile_id", kidProfileId);
  if (error) {
    console.error("[push] load kid devices failed", error);
    return 0;
  }
  if (!data?.length) return 0;

  const slug = await householdSlug(householdId);
  return deliver(data as DeviceRow[], {
    url: slug ? `/h/${slug}` : undefined,
    ...payload,
  });
}

// ============================================================================
// Events
// ============================================================================

function inBackground(work: () => Promise<unknown>) {
  after(async () => {
    try {
      await work();
    } catch (e) {
      console.error("[push] background send failed", e);
    }
  });
}

const pts = (n: number) => `${n.toLocaleString()} ${n === 1 ? "pt" : "pts"}`;

// Kid tapped Done → parents approve.
export function notifyTaskSubmitted(
  householdId: string,
  kidProfileId: string,
  taskName: string,
) {
  inBackground(async () => {
    const name = await kidName(kidProfileId);
    await notifyParents(householdId, {
      title: `${name} finished ${taskName}`,
      body: "Tap to approve.",
      tag: `approve-${kidProfileId}`,
    });
  });
}

// Kid sent "did something extra" → parents set points.
export function notifyProposalSubmitted(
  householdId: string,
  kidProfileId: string,
  what: string,
) {
  inBackground(async () => {
    const name = await kidName(kidProfileId);
    await notifyParents(householdId, {
      title: `${name} did something extra`,
      body: `${what} — tap to award points.`,
      tag: `approve-${kidProfileId}`,
    });
  });
}

// Parent approved a pending completion → that kid.
export function notifyCompletionApproved(
  householdId: string,
  kidProfileId: string,
  taskName: string,
  points: number,
) {
  inBackground(() =>
    notifyKid(householdId, kidProfileId, {
      title: `${taskName} approved!`,
      body: `+${pts(points)}`,
      tag: "approved",
    }),
  );
}

// Parent awarded a bonus → that kid.
export function notifyBonusAwarded(
  householdId: string,
  kidProfileId: string,
  reason: string,
  points: number,
) {
  inBackground(() =>
    notifyKid(householdId, kidProfileId, {
      title: `Bonus! +${pts(points)}`,
      body: reason,
      tag: "bonus",
    }),
  );
}
