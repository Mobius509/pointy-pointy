import "server-only";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { todayInTimezone, type Frequency } from "@/lib/time";

export type CompletionStatus = "pending" | "approved";
export type { Frequency } from "@/lib/time";

export type KidProfile = {
  id: string;
  household_id: string;
  name: string;
  avatar_emoji: string;
  sort_order: number;
};

export type V2Task = {
  id: string;
  household_id: string;
  name: string;
  description: string | null;
  points: number;
  recurring: boolean;
  active: boolean;
  sort_order: number;
  frequency: Frequency;
};

export type V2Completion = {
  id: string;
  household_id: string;
  kid_profile_id: string | null;
  task_id: string | null;
  task_name_snapshot: string;
  points_snapshot: number;
  completed_on: string;
  completed_at: string;
  is_bonus: boolean;
  status: CompletionStatus;
  note: string | null;
  period_key: string | null;
};

export type V2Goal = {
  id: string;
  household_id: string;
  kid_profile_id: string | null;
  name: string;
  target_points: number;
  started_at: string;
  redeemed_at: string | null;
};

export type V2GoalMilestone = {
  id: string;
  household_id: string;
  goal_id: string;
  name: string;
  points: number;
  sort_order: number;
};

// ============================================================================
// Household + kids
// ============================================================================

export async function getKidProfiles(householdId: string): Promise<KidProfile[]> {
  const { data, error } = await supabaseV2Admin
    .from("kid_profiles")
    .select("id, household_id, name, avatar_emoji, sort_order")
    .eq("household_id", householdId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data as KidProfile[]) ?? [];
}

export async function getKidProfile(id: string): Promise<KidProfile | null> {
  const { data, error } = await supabaseV2Admin
    .from("kid_profiles")
    .select("id, household_id, name, avatar_emoji, sort_order")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as KidProfile) ?? null;
}

// ============================================================================
// Tasks (household-wide)
// ============================================================================

export async function getActiveRecurringTasks(
  householdId: string,
): Promise<V2Task[]> {
  const { data, error } = await supabaseV2Admin
    .from("tasks")
    .select("*")
    .eq("household_id", householdId)
    .eq("active", true)
    .eq("recurring", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data as V2Task[]) ?? [];
}

export async function getAllTasks(householdId: string): Promise<V2Task[]> {
  const { data, error } = await supabaseV2Admin
    .from("tasks")
    .select("*")
    .eq("household_id", householdId)
    .order("recurring", { ascending: false })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data as V2Task[]) ?? [];
}

// ============================================================================
// Goals (per kid)
// ============================================================================

export async function getActiveGoalForKid(
  householdId: string,
  kidProfileId: string,
): Promise<V2Goal | null> {
  const { data, error } = await supabaseV2Admin
    .from("goals")
    .select("*")
    .eq("household_id", householdId)
    .eq("kid_profile_id", kidProfileId)
    .is("redeemed_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as V2Goal) ?? null;
}

// Milestones for a goal, sorted by their point threshold so the bar renders
// them in left-to-right order regardless of how parents typed them in.
//
// If the goal_milestones table hasn't been created yet (migration v2_0004
// not applied), swallow the "missing relation" error and return [] so the
// page still renders. Any other error bubbles up as usual.
export async function getMilestonesForGoal(
  householdId: string,
  goalId: string,
): Promise<V2GoalMilestone[]> {
  const { data, error } = await supabaseV2Admin
    .from("goal_milestones")
    .select("id, household_id, goal_id, name, points, sort_order")
    .eq("household_id", householdId)
    .eq("goal_id", goalId)
    .order("points", { ascending: true });
  if (error) {
    // Postgres error code 42P01 = "undefined_table". Supabase surfaces it
    // as `error.code === "42P01"` on the PostgREST response.
    if (error.code === "42P01" || error.code === "PGRST205") {
      console.warn(
        "[v2.goal_milestones] table not found — apply migration v2_0004",
      );
      return [];
    }
    throw error;
  }
  return (data as V2GoalMilestone[]) ?? [];
}

export async function getAllGoalsForKid(
  householdId: string,
  kidProfileId: string,
): Promise<V2Goal[]> {
  const { data, error } = await supabaseV2Admin
    .from("goals")
    .select("*")
    .eq("household_id", householdId)
    .eq("kid_profile_id", kidProfileId)
    .order("started_at", { ascending: false });
  if (error) throw error;
  return (data as V2Goal[]) ?? [];
}

// ============================================================================
// Completions (per kid)
// ============================================================================

export async function getKidGoalProgress(
  householdId: string,
  kidProfileId: string,
  goal: V2Goal,
): Promise<number> {
  const { data, error } = await supabaseV2Admin
    .from("completions")
    .select("points_snapshot")
    .eq("household_id", householdId)
    .eq("kid_profile_id", kidProfileId)
    .eq("status", "approved")
    .gte("completed_at", goal.started_at);
  if (error) throw error;
  return (data ?? []).reduce(
    (sum: number, row: { points_snapshot: number }) =>
      sum + (row.points_snapshot ?? 0),
    0,
  );
}

export async function getKidTodayCompletions(
  householdId: string,
  kidProfileId: string,
  timezone: string,
): Promise<V2Completion[]> {
  const today = todayInTimezone(timezone);
  const { data, error } = await supabaseV2Admin
    .from("completions")
    .select("*")
    .eq("household_id", householdId)
    .eq("kid_profile_id", kidProfileId)
    .eq("completed_on", today);
  if (error) throw error;
  return (data as V2Completion[]) ?? [];
}

// Fetch all of this kid's completions whose period_key matches one of the
// supplied keys. Used to figure out which non-daily tasks are already
// completed for the current period (week/month/year).
export async function getKidCompletionsForPeriods(
  householdId: string,
  kidProfileId: string,
  periodKeys: string[],
): Promise<V2Completion[]> {
  if (periodKeys.length === 0) return [];
  const { data, error } = await supabaseV2Admin
    .from("completions")
    .select("*")
    .eq("household_id", householdId)
    .eq("kid_profile_id", kidProfileId)
    .in("period_key", periodKeys);
  if (error) throw error;
  return (data as V2Completion[]) ?? [];
}

export async function getKidRecentCompletions(
  householdId: string,
  kidProfileId: string,
  limit = 12,
): Promise<V2Completion[]> {
  const { data, error } = await supabaseV2Admin
    .from("completions")
    .select("*")
    .eq("household_id", householdId)
    .eq("kid_profile_id", kidProfileId)
    .order("completed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as V2Completion[]) ?? [];
}

// All pending completions in the household (parent overview shows these
// across all kids for a single approval queue).
export async function getHouseholdPendingCompletions(
  householdId: string,
): Promise<V2Completion[]> {
  const { data, error } = await supabaseV2Admin
    .from("completions")
    .select("*")
    .eq("household_id", householdId)
    .eq("status", "pending")
    .order("completed_at", { ascending: true });
  if (error) throw error;
  return (data as V2Completion[]) ?? [];
}

export async function getHouseholdRecentCompletions(
  householdId: string,
  limit = 50,
): Promise<V2Completion[]> {
  const { data, error } = await supabaseV2Admin
    .from("completions")
    .select("*")
    .eq("household_id", householdId)
    .order("completed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as V2Completion[]) ?? [];
}
