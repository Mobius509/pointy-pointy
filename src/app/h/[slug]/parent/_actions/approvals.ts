"use server";

import { revalidatePath } from "next/cache";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { requireHouseholdAccess } from "@/lib/v2/auth";
import { notifyCompletionApproved, notifyCompletionsApproved } from "@/lib/v2/push";
import { checkStreakRewards } from "@/lib/v2/streaks";

// After approving: pay any streak rewards this completed. Never lets a
// streak problem block the approval itself.
async function payStreaks(householdId: string, timezone: string, kidProfileId: string) {
  try {
    await checkStreakRewards({ householdId, kidProfileId, timezone });
  } catch (e) {
    console.error("[streaks] reward check failed", e);
  }
}

export async function approveCompletionAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const household = await requireHouseholdAccess(slug);

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id.");

  const update: { status: "approved"; points_snapshot?: number } = {
    status: "approved",
  };
  const pointsRaw = formData.get("points");
  if (pointsRaw !== null && pointsRaw !== "") {
    const n = Number(pointsRaw);
    if (!Number.isFinite(n) || n < 0 || n > 1000) {
      throw new Error("Points must be between 0 and 1000.");
    }
    update.points_snapshot = Math.round(n);
  }

  const { data: approved, error } = await supabaseV2Admin
    .from("completions")
    .update(update)
    .eq("id", id)
    .eq("household_id", household.id)
    .select("kid_profile_id, task_id, task_name_snapshot, points_snapshot")
    .maybeSingle();
  if (error) throw error;

  if (approved?.kid_profile_id) {
    notifyCompletionApproved(
      household.id,
      approved.kid_profile_id as string,
      approved.task_name_snapshot as string,
      approved.points_snapshot as number,
    );
    if (approved.task_id) await payStreaks(household.id, household.timezone, approved.kid_profile_id as string);
  }

  revalidatePath(`/h/${slug}/parent`);
  revalidatePath(`/h/${slug}/parent/activity`);
  revalidatePath(`/h/${slug}`);
}

// "Approve all" for one kid: approves everything waiting, with a single
// notification. Suggested bonuses (the kid's "did something extra") get the
// points typed in their boxes, sent as `proposal_points:<id>`.
export async function approveAllCompletionsAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const household = await requireHouseholdAccess(slug);

  const kidProfileId = String(formData.get("kidProfileId") ?? "");
  if (!kidProfileId) throw new Error("Missing kid.");

  const { data: approved, error } = await supabaseV2Admin
    .from("completions")
    .update({ status: "approved" })
    .eq("household_id", household.id)
    .eq("kid_profile_id", kidProfileId)
    .eq("status", "pending")
    .or("task_id.not.is.null,is_bonus.eq.false") // suggestions below, with their points
    .select("task_name_snapshot, points_snapshot");
  if (error) throw error;
  const items = (approved ?? []).map((c) => ({
    name: c.task_name_snapshot as string,
    points: c.points_snapshot as number,
  }));

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("proposal_points:")) continue;
    const points = Number(value);
    if (!Number.isFinite(points) || points < 0 || points > 1000) throw new Error("Points must be between 0 and 1000.");
    const { data: proposal, error: proposalError } = await supabaseV2Admin
      .from("completions")
      .update({ status: "approved", points_snapshot: Math.round(points) })
      .eq("id", key.slice("proposal_points:".length))
      .eq("household_id", household.id)
      .eq("kid_profile_id", kidProfileId)
      .eq("status", "pending")
      .is("task_id", null)
      .eq("is_bonus", true)
      .select("task_name_snapshot, points_snapshot")
      .maybeSingle();
    if (proposalError) throw proposalError;
    if (proposal) items.push({ name: proposal.task_name_snapshot as string, points: proposal.points_snapshot as number });
  }

  notifyCompletionsApproved(household.id, kidProfileId, items);
  if (items.length) await payStreaks(household.id, household.timezone, kidProfileId);

  revalidatePath(`/h/${slug}/parent`);
  revalidatePath(`/h/${slug}/parent/activity`);
  revalidatePath(`/h/${slug}`);
}

export async function denyCompletionAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const household = await requireHouseholdAccess(slug);

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id.");

  const { error } = await supabaseV2Admin
    .from("completions")
    .delete()
    .eq("id", id)
    .eq("household_id", household.id);
  if (error) throw error;

  revalidatePath(`/h/${slug}/parent`);
  revalidatePath(`/h/${slug}/parent/activity`);
  revalidatePath(`/h/${slug}`);
}

export async function deleteCompletionAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const household = await requireHouseholdAccess(slug);

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id.");
  const { error } = await supabaseV2Admin
    .from("completions")
    .delete()
    .eq("id", id)
    .eq("household_id", household.id);
  if (error) throw error;

  revalidatePath(`/h/${slug}/parent`);
  revalidatePath(`/h/${slug}/parent/activity`);
  revalidatePath(`/h/${slug}`);
}
