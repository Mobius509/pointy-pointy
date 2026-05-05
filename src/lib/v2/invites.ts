import "server-only";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";

export type ValidInvite = {
  id: string;
  household_id: string;
  household_name: string;
  household_slug: string;
};

// Look up an invite by code and confirm it's still usable. Returns null when
// the invite doesn't exist, has expired, or has already been accepted.
export async function findValidInvite(
  code: string,
): Promise<ValidInvite | null> {
  if (!code) return null;
  const nowIso = new Date().toISOString();

  const { data, error } = await supabaseV2Admin
    .from("household_invites")
    .select("id, household_id, expires_at, accepted_at, households:household_id(name, slug)")
    .eq("code", code)
    .gte("expires_at", nowIso)
    .is("accepted_at", null)
    .maybeSingle();
  if (error || !data) return null;

  // Supabase's typegen renders this FK join as an array; runtime is either
  // an array or a single object depending on the relationship cardinality.
  const houseRel = (data as unknown as {
    households: { name: string; slug: string } | { name: string; slug: string }[] | null;
  }).households;
  const house = Array.isArray(houseRel) ? houseRel[0] : houseRel;
  if (!house) return null;

  return {
    id: data.id as string,
    household_id: data.household_id as string,
    household_name: house.name,
    household_slug: house.slug,
  };
}

// Mark an invite accepted by the given user. Idempotent in spirit — the
// caller should have already verified validity via findValidInvite.
export async function markInviteAccepted(
  inviteId: string,
  userId: string,
): Promise<void> {
  await supabaseV2Admin
    .from("household_invites")
    .update({
      accepted_at: new Date().toISOString(),
      accepted_by: userId,
    })
    .eq("id", inviteId)
    .is("accepted_at", null);
}
