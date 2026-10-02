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

// "How many of these each day": blank (or every one of them) = all.
function readTasksNeeded(formData: FormData, taskCount: number): number | null {
  const raw = String(formData.get("tasks_needed") ?? "").trim();
  if (!raw) return null;
  const n = parseWhole(raw, 1, 50, "Tasks needed each day");
  if (n > taskCount) throw new Error(`There are only ${taskCount} tasks in this streak — pick ${taskCount} or fewer.`);
  return n >= taskCount ? null : n;
}

// Saves the streak row. Before migration v2_0010 there's no tasks_needed
// column — then it's left out (all tasks needed).
async function saveStreak<T>(write: (row: Record<string, unknown>) => PromiseLike<T & { error: { code?: string } | null }>, row: Record<string, unknown>) {
  let res = await write(row);
  if (res.error && (res.error.code === "PGRST204" || res.error.code === "42703") && row.tasks_needed == null) {
    const { tasks_needed: _skip, ...rest } = row;
    void _skip;
    res = await write(rest);
  }
  return res;
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
  const tasks_needed = readTasksNeeded(formData, taskIds.length);

  const { data: last } = await supabaseV2Admin
    .from("streaks")
    .select("sort_order")
    .eq("household_id", household.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: streak, error } = await saveStreak(
    (row) => supabaseV2Admin.from("streaks").insert(row).select("id").single(),
    { household_id: household.id, ...fields, tasks_needed, sort_order: (last?.sort_order ?? 0) + 10 },
  );
  if (error || !streak) throw error ?? new Error("Couldn't add the streak.");
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
  const tasks_needed = readTasksNeeded(formData, taskIds.length);

  const { data: updated, error } = await saveStreak(
    (row) => supabaseV2Admin.from("streaks").update(row).eq("id", id).eq("household_id", household.id).select("id"),
    { ...fields, tasks_needed, active: formData.get("active") === "on" },
  );
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

// "Count this day": approve a kid's streak day (today, or a missed day in
// the last two weeks) even though not enough of its tasks were done — or
// undo it (`counted: false`). `day` is YYYY-MM-DD in the family's timezone.
export async function countStreakDayAction(
  slug: string,
  kidProfileId: string,
  streakId: string,
  day: string,
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
      String(day),
      user.id,
      counted,
    );
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  revalidate(slug);
  return { ok: true };
}
