import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { todayInTimezone } from "@/lib/time";

export type Task = {
  id: string;
  name: string;
  description: string | null;
  points: number;
  recurring: boolean;
  active: boolean;
  sort_order: number;
};

export type CompletionStatus = "pending" | "approved";

export type Completion = {
  id: string;
  task_id: string | null;
  task_name_snapshot: string;
  points_snapshot: number;
  completed_on: string;
  completed_at: string;
  is_bonus: boolean;
  note: string | null;
  status: CompletionStatus;
};

export type Goal = {
  id: string;
  name: string;
  target_points: number;
  started_at: string;
  redeemed_at: string | null;
};

export type Settings = {
  timezone: string;
  parent_pin_hash: string | null;
  kid_name: string | null;
};

export async function getSettings(): Promise<Settings> {
  const { data, error } = await supabaseAdmin
    .from("settings")
    .select("timezone, parent_pin_hash, kid_name")
    .eq("id", 1)
    .single();
  if (error) throw error;
  return data as Settings;
}

export async function getActiveGoal(): Promise<Goal | null> {
  const { data, error } = await supabaseAdmin
    .from("goals")
    .select("*")
    .is("redeemed_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as Goal) ?? null;
}

export async function getAllGoals(): Promise<Goal[]> {
  const { data, error } = await supabaseAdmin
    .from("goals")
    .select("*")
    .order("started_at", { ascending: false });
  if (error) throw error;
  return (data as Goal[]) ?? [];
}

export async function getActiveRecurringTasks(): Promise<Task[]> {
  const { data, error } = await supabaseAdmin
    .from("tasks")
    .select("*")
    .eq("active", true)
    .eq("recurring", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data as Task[]) ?? [];
}

export async function getAllTasks(): Promise<Task[]> {
  const { data, error } = await supabaseAdmin
    .from("tasks")
    .select("*")
    .order("recurring", { ascending: false })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data as Task[]) ?? [];
}

export async function getTodayCompletions(timezone: string): Promise<Completion[]> {
  const today = todayInTimezone(timezone);
  const { data, error } = await supabaseAdmin
    .from("completions")
    .select("*")
    .eq("completed_on", today);
  if (error) throw error;
  return (data as Completion[]) ?? [];
}

// Used by the kid view to show each task's state. Any pending submission
// keeps the task locked as "pending" until a parent approves or denies —
// even if the kid submitted on a previous day. Today's approved completions
// also come back so already-done daily tasks render as approved.
export async function getOpenAndTodayCompletions(
  timezone: string,
): Promise<Completion[]> {
  const today = todayInTimezone(timezone);
  const { data, error } = await supabaseAdmin
    .from("completions")
    .select("*")
    .or(`status.eq.pending,completed_on.eq.${today}`);
  if (error) throw error;
  return (data as Completion[]) ?? [];
}

export async function getRecentCompletions(limit = 12): Promise<Completion[]> {
  const { data, error } = await supabaseAdmin
    .from("completions")
    .select("*")
    .order("completed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as Completion[]) ?? [];
}

export async function getAllCompletions(limit = 200): Promise<Completion[]> {
  const { data, error } = await supabaseAdmin
    .from("completions")
    .select("*")
    .order("completed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as Completion[]) ?? [];
}

// Sum of approved points earned during the active goal's window.
export async function getGoalProgress(goal: Goal): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("completions")
    .select("points_snapshot")
    .eq("status", "approved")
    .gte("completed_at", goal.started_at);
  if (error) throw error;
  return (data ?? []).reduce(
    (sum: number, row: { points_snapshot: number }) => sum + (row.points_snapshot ?? 0),
    0,
  );
}

export async function getPendingCompletions(): Promise<Completion[]> {
  const { data, error } = await supabaseAdmin
    .from("completions")
    .select("*")
    .eq("status", "pending")
    .order("completed_at", { ascending: true });
  if (error) throw error;
  return (data as Completion[]) ?? [];
}
