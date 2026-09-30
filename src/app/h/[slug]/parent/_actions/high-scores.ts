"use server";

import { revalidatePath } from "next/cache";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { getCurrentUser, requireHouseholdAccess } from "@/lib/v2/auth";
import { getParentScoreName, getParentsPlay, submitHighScore } from "@/lib/v2/high-scores";

type Best = { score: number; initials: string };

// A parent finished a mini game round in the Celebrations gallery. Counts
// only when the family has "Parents can set high scores" on.
export async function submitParentHighScoreAction(
  slug: string,
  game: string,
  score: number,
): Promise<{ ok: true; best: Best; isNew: boolean } | { ok: false; error: string }> {
  const household = await requireHouseholdAccess(slug);
  if (!(await getParentsPlay(household.id))) return { ok: false, error: "Parents' scores are off." };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const name = await getParentScoreName(household.id, user.id, user.email);
  const res = await submitHighScore(household.id, { kind: "parent", userId: user.id, name }, game, score);
  if ("error" in res) return { ok: false, error: res.error };
  revalidatePath(`/h/${slug}/parent/settings`);
  return { ok: true, ...res };
}

export async function setParentsPlayAction(slug: string, on: boolean): Promise<{ ok: boolean }> {
  const household = await requireHouseholdAccess(slug);
  const { error } = await supabaseV2Admin
    .from("households")
    .update({ parents_play: on })
    .eq("id", household.id);
  revalidatePath(`/h/${slug}/parent/settings`);
  return { ok: !error };
}

export async function setScoreNameAction(slug: string, name: string): Promise<{ ok: boolean; error?: string }> {
  const household = await requireHouseholdAccess(slug);
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };
  // Arcade-style: up to 3 letters/numbers, uppercase ("DAD", "MOM", "MS").
  const clean = name.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase();
  const { error } = await supabaseV2Admin
    .from("household_members")
    .update({ score_name: clean || null })
    .eq("household_id", household.id)
    .eq("user_id", user.id);
  revalidatePath(`/h/${slug}/parent/settings`);
  return error ? { ok: false, error: "Couldn't save — has the high scores update been run?" } : { ok: true };
}
