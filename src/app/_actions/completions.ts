"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/server";
import { todayInTimezone } from "@/lib/time";
import { getSettings } from "@/lib/data";

// Kid taps a recurring task → row inserted as pending. The unique index
// enforces one completion per recurring task per day.
export async function completeTaskForToday(taskId: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const { data: task, error: taskErr } = await supabaseAdmin
    .from("tasks")
    .select("id, name, points, recurring, active")
    .eq("id", taskId)
    .single();
  if (taskErr || !task) return { ok: false, error: "Task not found." };
  if (!task.active || !task.recurring) {
    return { ok: false, error: "That task isn't available." };
  }

  const settings = await getSettings();
  const today = todayInTimezone(settings.timezone);

  const { error } = await supabaseAdmin.from("completions").insert({
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

  revalidatePath("/");
  return { ok: true };
}

// Kid changed their mind on a pending task. Only deletes pending rows for the
// given task on today's date — never approved ones (parent has to undo those).
export async function cancelPendingTaskForToday(taskId: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const settings = await getSettings();
  const today = todayInTimezone(settings.timezone);

  const { error } = await supabaseAdmin
    .from("completions")
    .delete()
    .eq("task_id", taskId)
    .eq("completed_on", today)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  return { ok: true };
}

// Kid suggests a one-off bonus they did. Goes to the parent's approval queue
// with no point value — parent decides the points when approving.
export async function submitKidProposal(name: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Tell us what you did first!" };
  if (trimmed.length > 120) {
    return { ok: false, error: "Keep it under 120 characters." };
  }

  const settings = await getSettings();
  const today = todayInTimezone(settings.timezone);

  const { error } = await supabaseAdmin.from("completions").insert({
    task_id: null,
    task_name_snapshot: trimmed,
    points_snapshot: 0,
    completed_on: today,
    is_bonus: true,
    status: "pending",
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  return { ok: true };
}

export async function cancelKidProposal(id: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  // Kid can only cancel their own pending proposals (is_bonus=true, status=pending).
  const { error } = await supabaseAdmin
    .from("completions")
    .delete()
    .eq("id", id)
    .eq("status", "pending")
    .eq("is_bonus", true);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  return { ok: true };
}
