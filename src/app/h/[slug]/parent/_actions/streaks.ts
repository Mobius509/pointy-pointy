"use server";

import { revalidatePath } from "next/cache";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { getCurrentUser, requireHouseholdAccess } from "@/lib/v2/auth";
import { countStreakDay } from "@/lib/v2/streaks";

// Parent-side streak setup (Tasks → Streaks). A streak is a set of daily
// tasks to do every day; every `days_required` days in a row pays
// `bonus_points` and an arcade ticket (see src/lib/v2/streaks.ts).

function parseWhole(raw: FormDataEntryValue | null, min: number, max: number, what: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${what} must be between ${min} and ${max}.`);
  return Math.round(n);
}

// The picked tasks (kept to this family's daily tasks), each with the
// weekdays it's needed — the days_<task id> boxes, 0 = Monday … 6 = Sunday,
// as a bitmask (127 = every day).
async function readTasks(formData: FormData, householdId: string): Promise<{ task_id: string; days: number }[]> {
  const ids = [...new Set(formData.getAll("task_ids").map(String))].filter(Boolean);
  if (ids.length === 0) throw new Error("Pick at least one task.");
  const { data, error } = await supabaseV2Admin
    .from("tasks")
    .select("id, name")
    .eq("household_id", householdId)
    .eq("frequency", "daily")
    .in("id", ids);
  if (error) throw error;
  const ok = data ?? [];
  if (ok.length === 0) throw new Error("Pick at least one daily task.");
  return ok.map((t) => {
    const days = formData
      .getAll(`days_${t.id}`)
      .map(Number)
      .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
      .reduce((mask, d) => mask | (1 << d), 0);
    if (!days) throw new Error(`Pick at least one day for ${t.name}.`);
    return { task_id: t.id as string, days };
  });
}

// Writes a streak's task list. Before migration v2_0010 there's no days
// column — then every task is every day.
async function writeTasks(streakId: string, tasks: { task_id: string; days: number }[]) {
  let { error } = await supabaseV2Admin.from("streak_tasks").insert(tasks.map((t) => ({ streak_id: streakId, ...t })));
  if (error && (error.code === "42703" || error.code === "PGRST204"))
    ({ error } = await supabaseV2Admin
      .from("streak_tasks")
      .insert(tasks.map((t) => ({ streak_id: streakId, task_id: t.task_id }))));
  if (error) throw error;
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
  const tasks = await readTasks(formData, household.id);

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
  await writeTasks(streak.id, tasks);
  revalidate(slug);
}

export async function updateStreakAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const household = await requireHouseholdAccess(slug);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing streak.");
  const fields = readFields(formData);
  const tasks = await readTasks(formData, household.id);

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
  await writeTasks(id, tasks);
  revalidate(slug);
}

export async function deleteStreakAction(slug: string, id: string): Promise<{ ok: boolean }> {
  const household = await requireHouseholdAccess(slug);
  const { error } = await supabaseV2Admin.from("streaks").delete().eq("id", id).eq("household_id", household.id);
  revalidate(slug);
  return { ok: !error };
}

// "Count this day": approve a kid's streak day (today or yesterday) even
// though its tasks weren't all done — or undo it (`counted: false`).
export async function countStreakDayAction(
  slug: string,
  kidProfileId: string,
  streakId: string,
  which: "today" | "yesterday",
  counted: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const household = await requireHouseholdAccess(slug);
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const { data: kid } = await supabaseV2Admin
    .from("kid_profiles")
    .select("id")
    .eq("id", kidProfileId)
    .eq("household_id", household.id)
    .maybeSingle();
  if (!kid) return { ok: false, error: "Kid not found." };
  try {
    await countStreakDay(
      { householdId: household.id, kidProfileId, timezone: household.timezone },
      streakId,
      which === "yesterday" ? "yesterday" : "today",
      user.id,
      counted,
    );
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  revalidate(slug);
  return { ok: true };
}
