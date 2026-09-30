import "server-only";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { verifyKidPin } from "@/lib/v2/auth";
import {
  getActiveGoalForKid,
  getActiveRecurringTasks,
  getKidCompletionsForPeriods,
  getKidGoalProgress,
  getKidProfile,
  getKidTodayCompletions,
  getMilestonesForGoal,
  type KidProfile,
  type V2Completion,
  type V2Goal,
  type V2GoalMilestone,
} from "@/lib/v2/data";
import {
  computePeriodKey,
  localTimeInTimezone,
  todayInTimezone,
  type Frequency,
} from "@/lib/time";
import { notifyProposalSubmitted, notifyTaskSubmitted } from "@/lib/v2/push";

// Kid-side operations shared by the web kid view (cookie session, server
// actions) and the native app API (bearer token, /api/v2/kid/*). Callers are
// responsible for establishing the session; everything here trusts `ctx`.

export type KidContext = {
  householdId: string;
  kidProfileId: string;
  timezone: string;
};

export type OpResult = { ok: true } | { ok: false; error: string };

export type ChecklistItemState = "open" | "pending" | "approved";

export type ChecklistItem = {
  id: string;
  name: string;
  description: string | null;
  points: number;
  frequency: Frequency;
  state: ChecklistItemState;
};

export type KidTodayView = {
  kid: KidProfile;
  goal: V2Goal | null;
  progress: number;
  milestones: V2GoalMilestone[];
  items: ChecklistItem[];
  pendingProposals: V2Completion[];
};

// ============================================================================
// Sign-in
// ============================================================================

// Verify the kid belongs to the household identified by `slug` (so a forged
// kid_profile_id from another household can't be used), then check the PIN.
export async function signInKid(
  slug: string,
  kidProfileId: string,
  pin: string,
): Promise<
  | { ok: true; householdId: string; kidProfileId: string }
  | { ok: false; error: string }
> {
  if (!slug || !kidProfileId) {
    return { ok: false, error: "Pick a kid and enter their PIN." };
  }

  const { data: kid, error } = await supabaseV2Admin
    .from("kid_profiles")
    .select("id, household_id, households:household_id(slug)")
    .eq("id", kidProfileId)
    .maybeSingle();
  if (error || !kid) return { ok: false, error: "Kid not found." };
  // Supabase's typegen renders this FK join as an array; runtime is either an
  // array or a single object depending on the relationship cardinality.
  const houseRel = (kid as unknown as {
    households: { slug: string } | { slug: string }[] | null;
  }).households;
  const kidHouseSlug = Array.isArray(houseRel)
    ? houseRel[0]?.slug
    : houseRel?.slug;
  if (kidHouseSlug !== slug) return { ok: false, error: "Kid not found." };

  const ok = await verifyKidPin(kidProfileId, pin);
  if (!ok) return { ok: false, error: "Wrong PIN." };

  return {
    ok: true,
    householdId: kid.household_id as string,
    kidProfileId,
  };
}

// ============================================================================
// Today's view
// ============================================================================

// Returns null if the kid profile no longer exists (e.g. a parent deleted it).
export async function getKidTodayView(
  ctx: KidContext,
): Promise<KidTodayView | null> {
  const kid = await getKidProfile(ctx.kidProfileId);
  if (!kid || kid.household_id !== ctx.householdId) return null;

  const tasks = await getActiveRecurringTasks(ctx.householdId);
  const todayCompletions = await getKidTodayCompletions(
    ctx.householdId,
    kid.id,
    ctx.timezone,
  );
  const goal = await getActiveGoalForKid(ctx.householdId, kid.id);
  const progress = goal
    ? await getKidGoalProgress(ctx.householdId, kid.id, goal)
    : 0;
  const milestones = goal
    ? await getMilestonesForGoal(ctx.householdId, goal.id)
    : [];

  const taskPeriodKey = new Map<string, string>(
    tasks.map((t) => [t.id, computePeriodKey(t.frequency, ctx.timezone)]),
  );
  const distinctPeriodKeys = [...new Set(taskPeriodKey.values())];
  const periodCompletions = await getKidCompletionsForPeriods(
    ctx.householdId,
    kid.id,
    distinctPeriodKeys,
  );

  const stateByTaskId = new Map<string, "pending" | "approved">();
  for (const c of periodCompletions) {
    if (c.is_bonus || !c.task_id) continue;
    if (taskPeriodKey.get(c.task_id) === c.period_key) {
      stateByTaskId.set(c.task_id, c.status);
    }
  }
  const items: ChecklistItem[] = tasks.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    points: t.points,
    frequency: t.frequency,
    state: stateByTaskId.get(t.id) ?? "open",
  }));

  const pendingProposals = todayCompletions.filter(
    (c) => c.is_bonus && c.task_id === null && c.status === "pending",
  );

  return { kid, goal, progress, milestones, items, pendingProposals };
}

// ============================================================================
// Task completions
// ============================================================================

export async function completeTaskForToday(
  ctx: KidContext,
  taskId: string,
): Promise<OpResult> {
  const { data: task, error: taskErr } = await supabaseV2Admin
    .from("tasks")
    .select("id, name, points, recurring, active, household_id, frequency")
    .eq("id", taskId)
    .eq("household_id", ctx.householdId)
    .maybeSingle();
  if (taskErr || !task) return { ok: false, error: "Task not found." };
  if (!task.active || !task.recurring) {
    return { ok: false, error: "That task isn't available." };
  }

  const today = todayInTimezone(ctx.timezone);
  const periodKey = computePeriodKey(
    (task.frequency ?? "daily") as Frequency,
    ctx.timezone,
  );

  const { error } = await supabaseV2Admin.from("completions").insert({
    household_id: ctx.householdId,
    kid_profile_id: ctx.kidProfileId,
    task_id: task.id,
    task_name_snapshot: task.name,
    points_snapshot: task.points,
    completed_on: today,
    is_bonus: false,
    status: "pending",
    period_key: periodKey,
  });

  if (error) {
    if (error.code === "23505") return { ok: true }; // already submitted today
    return { ok: false, error: error.message };
  }
  notifyTaskSubmitted(ctx.householdId, ctx.kidProfileId, task.name as string);
  return { ok: true };
}

// Deletes this period's completion for the task in the given status. Looks
// up the task's frequency so we hit the right period bucket (a weekly task's
// pending row may not have completed_on=today).
async function deleteCurrentPeriodCompletion(
  ctx: KidContext,
  taskId: string,
  status: "pending" | "approved",
): Promise<OpResult> {
  const { data: task } = await supabaseV2Admin
    .from("tasks")
    .select("frequency")
    .eq("id", taskId)
    .eq("household_id", ctx.householdId)
    .maybeSingle();
  const frequency = (task?.frequency ?? "daily") as Frequency;
  const periodKey = computePeriodKey(frequency, ctx.timezone);

  const { error } = await supabaseV2Admin
    .from("completions")
    .delete()
    .eq("household_id", ctx.householdId)
    .eq("kid_profile_id", ctx.kidProfileId)
    .eq("task_id", taskId)
    .eq("period_key", periodKey)
    .eq("status", status);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export function cancelPendingTaskForToday(
  ctx: KidContext,
  taskId: string,
): Promise<OpResult> {
  return deleteCurrentPeriodCompletion(ctx, taskId, "pending");
}

// Kid pulls an APPROVED task back — deletes the completion entirely, so the
// task flips back to open and the points come off the goal. Useful when a
// parent approved by mistake or the kid changes their mind about counting it.
export function recallApprovedTask(
  ctx: KidContext,
  taskId: string,
): Promise<OpResult> {
  return deleteCurrentPeriodCompletion(ctx, taskId, "approved");
}

// ============================================================================
// "Did something extra?" proposals
// ============================================================================

export async function submitKidProposal(
  ctx: KidContext,
  name: string,
): Promise<OpResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Tell us what you did first!" };
  if (trimmed.length > 120) {
    return { ok: false, error: "Keep it under 120 characters." };
  }

  const today = todayInTimezone(ctx.timezone);

  const { error } = await supabaseV2Admin.from("completions").insert({
    household_id: ctx.householdId,
    kid_profile_id: ctx.kidProfileId,
    task_id: null,
    task_name_snapshot: trimmed,
    points_snapshot: 0,
    completed_on: today,
    is_bonus: true,
    status: "pending",
    period_key: `D-${today}`,
  });
  if (error) return { ok: false, error: error.message };
  notifyProposalSubmitted(ctx.householdId, ctx.kidProfileId, trimmed);
  return { ok: true };
}

export async function cancelKidProposal(
  ctx: KidContext,
  id: string,
): Promise<OpResult> {
  const { error } = await supabaseV2Admin
    .from("completions")
    .delete()
    .eq("id", id)
    .eq("household_id", ctx.householdId)
    .eq("kid_profile_id", ctx.kidProfileId)
    .eq("status", "pending")
    .eq("is_bonus", true);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ============================================================================
// Settings — daily reminder
// ============================================================================

// "HH:MM" (24h) in the household's timezone, or null when off.
export async function getKidReminderTime(ctx: KidContext): Promise<string | null> {
  const { data, error } = await supabaseV2Admin
    .from("kid_profiles")
    .select("reminder_time")
    .eq("id", ctx.kidProfileId)
    .eq("household_id", ctx.householdId)
    .maybeSingle();
  if (error) throw error;
  const t = data?.reminder_time as string | null | undefined;
  return t ? t.slice(0, 5) : null;
}

export async function setKidReminderTime(
  ctx: KidContext,
  time: string | null,
): Promise<OpResult> {
  if (time !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    return { ok: false, error: "Pick a time like 18:30." };
  }

  // If today's reminder time has already passed, start tomorrow — otherwise
  // the next cron tick would fire it immediately.
  const now = localTimeInTimezone(ctx.timezone);
  const today = todayInTimezone(ctx.timezone);

  const { error } = await supabaseV2Admin
    .from("kid_profiles")
    .update({
      reminder_time: time,
      last_reminded_on: time !== null && time <= now ? today : null,
    })
    .eq("id", ctx.kidProfileId)
    .eq("household_id", ctx.householdId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
