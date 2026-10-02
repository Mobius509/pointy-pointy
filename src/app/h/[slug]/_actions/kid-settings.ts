"use server";

import { revalidatePath } from "next/cache";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { getKidSession } from "@/lib/v2/auth";
import { AVATAR_IDS } from "@/lib/avatar";
import { cleanInitials } from "@/lib/initials";
import { getKidInitials, renameHighScoreHolder } from "@/lib/v2/high-scores";
import { setKidReminderTime, type OpResult } from "@/lib/v2/kid-ops";
import { setKidHue } from "@/lib/v2/kid-home";

// Kid-side action: update the signed-in kid's own avatar. Only the kid
// session is required (no parent auth). The kid can only change their own
// row because the session cookie pins the kid_profile_id.
export async function updateKidAvatarAction(
  slug: string,
  avatar: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getKidSession();
  if (!session) return { ok: false, error: "Sign in first." };

  if (!(AVATAR_IDS as readonly string[]).includes(avatar)) {
    return { ok: false, error: "Unknown avatar." };
  }

  // Verify the household matches the slug — defense-in-depth so a stale
  // cookie can't write into a different household.
  const { data: household } = await supabaseV2Admin
    .from("households")
    .select("id, slug")
    .eq("id", session.householdId)
    .maybeSingle();
  if (!household || household.slug !== slug) {
    return { ok: false, error: "Sign in first." };
  }

  const { error } = await supabaseV2Admin
    .from("kid_profiles")
    .update({ avatar_emoji: avatar })
    .eq("id", session.kidProfileId)
    .eq("household_id", session.householdId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/h/${slug}`);
  revalidatePath(`/h/${slug}/settings`);
  revalidatePath(`/h/${slug}/parent`);
  return { ok: true };
}

// Kid-side action: set (or clear, with null) the daily reminder time.
export async function updateKidReminderAction(
  slug: string,
  time: string | null,
): Promise<OpResult> {
  const session = await getKidSession();
  if (!session) return { ok: false, error: "Sign in first." };

  const { data: household } = await supabaseV2Admin
    .from("households")
    .select("id, slug, timezone")
    .eq("id", session.householdId)
    .maybeSingle();
  if (!household || household.slug !== slug) {
    return { ok: false, error: "Sign in first." };
  }

  const res = await setKidReminderTime(
    {
      householdId: session.householdId,
      kidProfileId: session.kidProfileId,
      timezone: household.timezone as string,
    },
    time,
  );
  if (res.ok) revalidatePath(`/h/${slug}/settings`);
  return res;
}

// Kid-side action: set their own high score initials (blank = back to the
// default, first initial + family initial).
export async function updateKidInitialsAction(
  slug: string,
  initials: string,
): Promise<{ ok: true; initials: string } | { ok: false; error: string }> {
  const session = await getKidSession();
  if (!session) return { ok: false, error: "Sign in first." };

  const { data: household } = await supabaseV2Admin
    .from("households")
    .select("id, slug")
    .eq("id", session.householdId)
    .maybeSingle();
  if (!household || household.slug !== slug) {
    return { ok: false, error: "Sign in first." };
  }

  const clean = cleanInitials(initials) || null;
  const { error } = await supabaseV2Admin
    .from("kid_profiles")
    .update({ initials: clean })
    .eq("id", session.kidProfileId)
    .eq("household_id", session.householdId);
  if (error) return { ok: false, error: error.message };
  const shown = (await getKidInitials(session.householdId))[session.kidProfileId] ?? clean ?? "";
  await renameHighScoreHolder(session.householdId, { kind: "kid", kidProfileId: session.kidProfileId }, shown);

  revalidatePath(`/h/${slug}`);
  revalidatePath(`/h/${slug}/settings`);
  revalidatePath(`/h/${slug}/parent/settings`);
  return { ok: true, initials: shown };
}

// Kid-side action: the kid's color (a hue, 0–359 — see kid-palette.ts).
export async function updateKidHueAction(
  slug: string,
  hue: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getKidSession();
  if (!session) return { ok: false, error: "Sign in first." };
  if (!Number.isFinite(hue)) return { ok: false, error: "Pick a color." };
  const { data: household } = await supabaseV2Admin
    .from("households")
    .select("id, slug, timezone")
    .eq("id", session.householdId)
    .maybeSingle();
  if (!household || household.slug !== slug) return { ok: false, error: "Sign in first." };
  try {
    await setKidHue(
      { householdId: session.householdId, kidProfileId: session.kidProfileId, timezone: household.timezone as string },
      hue,
    );
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  revalidatePath(`/h/${slug}`, "layout");
  return { ok: true };
}
