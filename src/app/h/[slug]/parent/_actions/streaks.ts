"use server";

import { revalidatePath } from "next/cache";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { requireHouseholdAccess } from "@/lib/v2/auth";

// Parent-side streak setup (Tasks → Streaks). A streak is a set of daily
// tasks to do every day; every `days_required` days in a row pays
// `bonus_points` and an arcade ticket (see src/lib/v2/streaks.ts).

function parseWhole(raw: FormDataEntryValue | null, min: number, max: number, what: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${what} must be between ${min} and ${max}.`);
  return Math.round(n);
}

// The picked tasks, kept to this family's daily tasks.
async function readTaskIds(formData: FormData, householdId: string): Promise<string[]> {
  const ids = [...new Set(formData.getAll("task_ids").map(String))].filter(Boolean);
  if (ids.length === 0) throw new Error("Pick at least one task.");
  const { data, error } = await supabaseV2Admin
    .from("tasks")
    .select("id")
    .eq("household_id", householdId)
    .eq("frequency", "daily")
    .in("id", ids);
  if (error) throw error;
  const ok = (data ?? []).map((t) => t.id as string);
  if (ok.length === 0) throw new Error("Pick at least one daily task.");
  return ok;
}

function readFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name required.");
  return {
    name,
    days_required: parseWhole(formData.get("days_required"), 2, 365, "Days in a row"),
    bonus_points: parseWhole(formData.get("bonus_points"), 0, 1000, "Bonus points"),
    skip_weekends: formData.get("skip_weekends") === "on",
  };
}

function revalidate(slug: string) {
  revalidatePath(`/h/${slug}/parent/tasks`);
  revalidatePath(`/h/${slug}/parent`);
  revalidatePath(`/h/${slug}`);
}

export async function createStreakAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const household = await requireHouseholdAccess(slug);
  const fields = readFields(formData);
  const taskIds = await readTaskIds(formData, household.id);

  const { data: last } = await supabaseV2Admin
    .from("streaks")
    .select("sort_order")
    .eq("household_id", household.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: streak, error } = await supabaseV2Admin
    .from("streaks")
    .insert({ household_id: household.id, ...fields, sort_order: (last?.sort_order ?? 0) + 10 })
    .select("id")
    .single();
  if (error) throw error;
  const { error: linkError } = await supabaseV2Admin
    .from("streak_tasks")
    .insert(taskIds.map((task_id) => ({ streak_id: streak.id, task_id })));
  if (linkError) throw linkError;
  revalidate(slug);
}

export async function updateStreakAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const household = await requireHouseholdAccess(slug);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing streak.");
  const fields = readFields(formData);
  const taskIds = await readTaskIds(formData, household.id);

  const { data: updated, error } = await supabaseV2Admin
    .from("streaks")
    .update({ ...fields, active: formData.get("active") === "on" })
    .eq("id", id)
    .eq("household_id", household.id)
    .select("id");
  if (error) throw error;
  if (!updated?.length) throw new Error("Streak not found.");
  // Replace its task list.
  await supabaseV2Admin.from("streak_tasks").delete().eq("streak_id", id);
  const { error: linkError } = await supabaseV2Admin
    .from("streak_tasks")
    .insert(taskIds.map((task_id) => ({ streak_id: id, task_id })));
  if (linkError) throw linkError;
  revalidate(slug);
}

export async function deleteStreakAction(slug: string, id: string): Promise<{ ok: boolean }> {
  const household = await requireHouseholdAccess(slug);
  const { error } = await supabaseV2Admin.from("streaks").delete().eq("id", id).eq("household_id", household.id);
  revalidate(slug);
  return { ok: !error };
}
