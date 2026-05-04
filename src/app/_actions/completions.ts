"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/server";
import { todayInTimezone } from "@/lib/time";
import { getSettings } from "@/lib/data";

// Kid-view action: complete a recurring task for today.
// No PIN required (the kid uses this), but we only allow active recurring tasks
// and the unique index in the DB enforces one completion per task per day.
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

  const { error: insertErr } = await supabaseAdmin.from("completions").insert({
    task_id: task.id,
    task_name_snapshot: task.name,
    points_snapshot: task.points,
    completed_on: today,
    is_bonus: false,
    status: "pending",
  });

  if (insertErr) {
    if (insertErr.code === "23505") {
      // Unique violation = already completed today. Treat as success.
      return { ok: true };
    }
    return { ok: false, error: insertErr.message };
  }

  revalidatePath("/");
  return { ok: true };
}
