"use server";

import { revalidatePath } from "next/cache";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { requireHouseholdAccess } from "@/lib/v2/auth";

// All milestone actions are parent-only (gated by requireHouseholdAccess).
// Kids see milestones on their progress bar but can't add/remove them.

function parsePoints(raw: FormDataEntryValue | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) {
    throw new Error("Points must be a positive number.");
  }
  return Math.round(n);
}

// Confirms the goal belongs to the parent's household. Returns the goal
// row so callers can validate the milestone's points against the goal's
// target.
async function loadGoal(householdId: string, goalId: string) {
  const { data, error } = await supabaseV2Admin
    .from("goals")
    .select("id, target_points, household_id")
    .eq("id", goalId)
    .eq("household_id", householdId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Goal not found.");
  return data as { id: string; target_points: number; household_id: string };
}

export async function createMilestoneAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const household = await requireHouseholdAccess(slug);

  const goalId = String(formData.get("goal_id") ?? "");
  if (!goalId) throw new Error("Missing goal id.");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Reward name required.");
  const points = parsePoints(formData.get("points"));

  const goal = await loadGoal(household.id, goalId);
  if (points >= goal.target_points) {
    throw new Error("Milestone must be less than the goal's target.");
  }

  // Pick a sort_order at the end of the existing list. Display order is
  // really driven by points asc, but we keep a sort_order column in case
  // parents later want to reorder ties manually.
  const { data: max } = await supabaseV2Admin
    .from("goal_milestones")
    .select("sort_order")
    .eq("goal_id", goalId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort_order = (max?.sort_order ?? 0) + 10;

  const { error } = await supabaseV2Admin.from("goal_milestones").insert({
    household_id: household.id,
    goal_id: goalId,
    name,
    points,
    sort_order,
  });
  if (error) throw error;

  revalidatePath(`/v2/h/${slug}/parent/goal`);
  revalidatePath(`/v2/h/${slug}`);
}

export async function updateMilestoneAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const household = await requireHouseholdAccess(slug);

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing milestone id.");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Reward name required.");
  const points = parsePoints(formData.get("points"));

  // Need the goal_id to check the target_points constraint. Read it back
  // from the existing row.
  const { data: existing, error: readErr } = await supabaseV2Admin
    .from("goal_milestones")
    .select("goal_id")
    .eq("id", id)
    .eq("household_id", household.id)
    .maybeSingle();
  if (readErr) throw readErr;
  if (!existing) throw new Error("Milestone not found.");

  const goal = await loadGoal(household.id, existing.goal_id as string);
  if (points >= goal.target_points) {
    throw new Error("Milestone must be less than the goal's target.");
  }

  const { error } = await supabaseV2Admin
    .from("goal_milestones")
    .update({ name, points })
    .eq("id", id)
    .eq("household_id", household.id);
  if (error) throw error;

  revalidatePath(`/v2/h/${slug}/parent/goal`);
  revalidatePath(`/v2/h/${slug}`);
}

export async function deleteMilestoneAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const household = await requireHouseholdAccess(slug);

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing milestone id.");

  const { error } = await supabaseV2Admin
    .from("goal_milestones")
    .delete()
    .eq("id", id)
    .eq("household_id", household.id);
  if (error) throw error;

  revalidatePath(`/v2/h/${slug}/parent/goal`);
  revalidatePath(`/v2/h/${slug}`);
}
