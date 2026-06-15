"use server";

import { revalidatePath } from "next/cache";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { getKidSession } from "@/lib/v2/auth";
import { AVATAR_IDS } from "@/lib/avatar";

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
