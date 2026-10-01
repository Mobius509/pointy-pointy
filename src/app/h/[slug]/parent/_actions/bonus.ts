"use server";

import { revalidatePath } from "next/cache";
import { requireHouseholdAccess } from "@/lib/v2/auth";
import { insertBonusCompletion } from "@/lib/v2/bonus";
import { notifyBonusAwarded } from "@/lib/v2/push";

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

  await insertBonusCompletion({
    householdId: household.id,
    kidProfileId,
    timezone: household.timezone,
    name,
    points,
    note,
  });

  notifyBonusAwarded(household.id, kidProfileId, name, Math.round(points));

  revalidatePath(`/h/${slug}/parent`);
  revalidatePath(`/h/${slug}/parent/activity`);
  revalidatePath(`/h/${slug}/parent/bonus`);
  revalidatePath(`/h/${slug}`);
}
