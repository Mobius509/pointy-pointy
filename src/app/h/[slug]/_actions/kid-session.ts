"use server";

import { revalidatePath } from "next/cache";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import {
  clearKidSession,
  setKidSession,
  verifyKidPin,
} from "@/lib/v2/auth";

// Verify a kid's PIN against their stored bcrypt hash and, on success,
// set the kid_session cookie. No parent auth required — anyone with the
// household URL plus the kid's PIN can sign in as that kid (by design).
export async function kidSignInAction(formData: FormData): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const slug = String(formData.get("slug") ?? "");
  const kidProfileId = String(formData.get("kid_profile_id") ?? "");
  const pin = String(formData.get("pin") ?? "");
  if (!slug || !kidProfileId) {
    return { ok: false, error: "Pick a kid and enter their PIN." };
  }

  // Verify the kid belongs to the household identified by `slug` so a forged
  // kid_profile_id from another household can't be used.
  const { data: kid, error } = await supabaseV2Admin
    .from("kid_profiles")
    .select("id, household_id, households:household_id(slug)")
    .eq("id", kidProfileId)
    .maybeSingle();
  if (error || !kid) return { ok: false, error: "Kid not found." };
  // Supabase's typegen renders this FK join as an array; runtime is either an
  // array or a single object depending on the relationship cardinality.
  const houseRel = (kid as unknown as {
    households: { slug: string } | { slug: string }[] | null;
  }).households;
  const kidHouseSlug = Array.isArray(houseRel)
    ? houseRel[0]?.slug
    : houseRel?.slug;
  if (kidHouseSlug !== slug) return { ok: false, error: "Kid not found." };

  const ok = await verifyKidPin(kidProfileId, pin);
  if (!ok) return { ok: false, error: "Wrong PIN." };

  await setKidSession({
    householdId: kid.household_id as string,
    kidProfileId,
  });
  revalidatePath(`/h/${slug}`);
  return { ok: true };
}

export async function kidSignOutAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  await clearKidSession();
  revalidatePath(`/h/${slug}`);
}
