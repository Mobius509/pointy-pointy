"use server";

import { revalidatePath } from "next/cache";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { requireHouseholdAccess } from "@/lib/v2/auth";
import { todayInTimezone } from "@/lib/time";

export async function awardCustomBonusAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const household = await requireHouseholdAccess(slug);

  const kidProfileId = String(formData.get("kid_profile_id") ?? "");
  if (!kidProfileId) throw new Error("Pick a kid.");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name required.");
  const points = Number(formData.get("points"));
  if (!Number.isFinite(points) || points < 0 || points > 1000) {
    throw new Error("Points must be 0–1000.");
  }
  const note = String(formData.get("note") ?? "").trim() || null;

  const today = todayInTimezone(household.timezone);

  const { error } = await supabaseV2Admin.from("completions").insert({
    household_id: household.id,
    kid_profile_id: kidProfileId,
    task_id: null,
    task_name_snapshot: name,
    points_snapshot: Math.round(points),
    completed_on: today,
    is_bonus: true,
    status: "approved",
    note,
    period_key: `D-${today}`,
  });
  if (error) throw error;

  revalidatePath(`/h/${slug}/parent`);
  revalidatePath(`/h/${slug}/parent/activity`);
  revalidatePath(`/h/${slug}/parent/bonus`);
  revalidatePath(`/h/${slug}`);
}
