"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireParent } from "@/lib/auth/pin";
import { getSettings } from "@/lib/data";
import { todayInTimezone } from "@/lib/time";

export async function awardCustomBonusAction(formData: FormData) {
  await requireParent();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name required.");
  const points = Number(formData.get("points"));
  if (!Number.isFinite(points) || points < 0 || points > 1000) {
    throw new Error("Points must be 0–1000.");
  }
  const note = String(formData.get("note") ?? "").trim() || null;

  const settings = await getSettings();
  const today = todayInTimezone(settings.timezone);

  const { error } = await supabaseAdmin.from("completions").insert({
    task_id: null,
    task_name_snapshot: name,
    points_snapshot: Math.round(points),
    completed_on: today,
    is_bonus: true,
    note,
  });
  if (error) throw error;

  revalidatePath("/parent");
  revalidatePath("/parent/activity");
  revalidatePath("/parent/bonus");
  revalidatePath("/");
}
