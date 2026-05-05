"use server";

import { revalidatePath } from "next/cache";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { getKidSession } from "@/lib/v2/auth";
import { todayInTimezone } from "@/lib/time";

// All actions in this file require a valid kid_session cookie. The cookie
// pins the household_id + kid_profile_id, so a kid can only act for
// themselves and only within their own household.
async function requireKidSessionForSlug(slug: string): Promise<{
  householdId: string;
  kidProfileId: string;
  timezone: string;
}> {
  const session = await getKidSession();
  if (!session) throw new Error("Sign in first.");

  const { data: household, error } = await supabaseV2Admin
    .from("households")
    .select("id, slug, timezone")
    .eq("id", session.householdId)
    .maybeSingle();
  if (error) throw error;
  if (!household || household.slug !== slug) throw new Error("Sign in first.");

  return {
    householdId: session.householdId,
    kidProfileId: session.kidProfileId,
    timezone: household.timezone as string,
  };
}

export async function completeTaskForTodayAction(
  slug: string,
  taskId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let s;
  try {
    s = await requireKidSessionForSlug(slug);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const { data: task, error: taskErr } = await supabaseV2Admin
    .from("tasks")
    .select("id, name, points, recurring, active, household_id")
    .eq("id", taskId)
    .eq("household_id", s.householdId)
    .maybeSingle();
  if (taskErr || !task) return { ok: false, error: "Task not found." };
  if (!task.active || !task.recurring) {
    return { ok: false, error: "That task isn't available." };
  }

  const today = todayInTimezone(s.timezone);

  const { error } = await supabaseV2Admin.from("completions").insert({
    household_id: s.householdId,
    kid_profile_id: s.kidProfileId,
    task_id: task.id,
    task_name_snapshot: task.name,
    points_snapshot: task.points,
    completed_on: today,
    is_bonus: false,
    status: "pending",
  });

  if (error) {
    if (error.code === "23505") return { ok: true }; // already submitted today
    return { ok: false, error: error.message };
  }

  revalidatePath(`/v2/h/${slug}`);
  revalidatePath(`/v2/h/${slug}/parent`);
  return { ok: true };
}

export async function cancelPendingTaskForTodayAction(
  slug: string,
  taskId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let s;
  try {
    s = await requireKidSessionForSlug(slug);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const today = todayInTimezone(s.timezone);

  const { error } = await supabaseV2Admin
    .from("completions")
    .delete()
    .eq("household_id", s.householdId)
    .eq("kid_profile_id", s.kidProfileId)
    .eq("task_id", taskId)
    .eq("completed_on", today)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/v2/h/${slug}`);
  revalidatePath(`/v2/h/${slug}/parent`);
  return { ok: true };
}

export async function submitKidProposalAction(
  slug: string,
  name: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let s;
  try {
    s = await requireKidSessionForSlug(slug);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Tell us what you did first!" };
  if (trimmed.length > 120) {
    return { ok: false, error: "Keep it under 120 characters." };
  }

  const today = todayInTimezone(s.timezone);

  const { error } = await supabaseV2Admin.from("completions").insert({
    household_id: s.householdId,
    kid_profile_id: s.kidProfileId,
    task_id: null,
    task_name_snapshot: trimmed,
    points_snapshot: 0,
    completed_on: today,
    is_bonus: true,
    status: "pending",
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/v2/h/${slug}`);
  revalidatePath(`/v2/h/${slug}/parent`);
  return { ok: true };
}

export async function cancelKidProposalAction(
  slug: string,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let s;
  try {
    s = await requireKidSessionForSlug(slug);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const { error } = await supabaseV2Admin
    .from("completions")
    .delete()
    .eq("id", id)
    .eq("household_id", s.householdId)
    .eq("kid_profile_id", s.kidProfileId)
    .eq("status", "pending")
    .eq("is_bonus", true);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/v2/h/${slug}`);
  revalidatePath(`/v2/h/${slug}/parent`);
  return { ok: true };
}
