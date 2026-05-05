import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { createV2ServerClient } from "@/lib/supabase/v2-server";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";

export type Household = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
};

// ============================================================================
// Parent (Supabase auth) helpers
// ============================================================================

// Returns the current authenticated user (or null) — fast, doesn't query DB.
export async function getCurrentUser() {
  const supabase = await createV2ServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Returns the household for the given slug if the current user is a member.
// Used by parent-only pages.
export async function requireHouseholdAccess(slug: string): Promise<Household> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/v2/sign-in?next=${encodeURIComponent(`/v2/h/${slug}/parent`)}`);
  }

  const { data: household, error } = await supabaseV2Admin
    .from("households")
    .select("id, name, slug, timezone")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!household) redirect("/v2");

  const { data: member } = await supabaseV2Admin
    .from("household_members")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("household_id", household.id)
    .maybeSingle();
  if (!member) redirect("/v2");

  return household as Household;
}

// Returns the first household this user is a member of (or null).
export async function getFirstHouseholdForCurrentUser(): Promise<Household | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data: membership, error } = await supabaseV2Admin
    .from("household_members")
    .select("household_id, households(id, name, slug, timezone)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  const h = (membership as { households: Household | null } | null)?.households;
  return h ?? null;
}

// ============================================================================
// Kid (PIN) session — kids don't use Supabase auth; we store a small signed
// cookie with { household_id, kid_profile_id } after PIN verification.
// ============================================================================

const KID_COOKIE = "pp_v2_kid";
const KID_COOKIE_TTL = 60 * 60 * 12; // 12 hours

type KidSession = {
  householdId: string;
  kidProfileId: string;
};

// Cookies are httpOnly and same-site lax — not user-tamperable in normal use.
// Anyone with shell access to the kid's device could forge one, but the
// blast radius is "completes a fake task on their own goal" so we don't
// HMAC-sign for now. Worth revisiting if kids start sharing devices.
function encodeKidSession(s: KidSession): string {
  return Buffer.from(JSON.stringify(s)).toString("base64url");
}
function decodeKidSession(raw: string): KidSession | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf-8"));
    if (
      typeof parsed.householdId === "string" &&
      typeof parsed.kidProfileId === "string"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function getKidSession(): Promise<KidSession | null> {
  const jar = await cookies();
  const raw = jar.get(KID_COOKIE)?.value;
  return raw ? decodeKidSession(raw) : null;
}

export async function setKidSession(session: KidSession): Promise<void> {
  const jar = await cookies();
  jar.set(KID_COOKIE, encodeKidSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: KID_COOKIE_TTL,
  });
}

export async function clearKidSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(KID_COOKIE);
}

// Verify a kid's PIN against the stored bcrypt hash. Returns true on success;
// caller should then call setKidSession.
export async function verifyKidPin(
  kidProfileId: string,
  pin: string,
): Promise<boolean> {
  const { data, error } = await supabaseV2Admin
    .from("kid_profiles")
    .select("pin_hash, household_id")
    .eq("id", kidProfileId)
    .maybeSingle();
  if (error || !data) return false;
  const ok = await bcrypt.compare(pin, data.pin_hash);
  return ok;
}

// Hash a PIN for storage. Used when parents create/update a kid profile.
export async function hashPin(pin: string): Promise<string> {
  if (!/^\d{4,8}$/.test(pin)) {
    throw new Error("PIN must be 4–8 digits.");
  }
  return bcrypt.hash(pin, 10);
}
