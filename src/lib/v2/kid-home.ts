import "server-only";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { greeting } from "@/lib/greetings";
import { normalizeHue } from "@/lib/kid-palette";
import { localTimeInTimezone, todayInTimezone } from "@/lib/time";
import { getKidInitials } from "@/lib/v2/high-scores";
import { getKidTodayView, type KidContext, type KidTodayView, type RecentApproval } from "@/lib/v2/kid-ops";
import { getArcade, getKidStreaks, type Arcade, type KidStreak } from "@/lib/v2/streaks";

// Everything the kid app's home (Stats) and tabs show, in one place — the
// web pages and the iOS API (/api/v2/kid/today) both use this, so the two
// apps always agree (GROUND_RULES.md rule 1).

export type KidHome = {
  view: KidTodayView;
  streaks: KidStreak[];
  arcade: Arcade;
  householdName: string;
  initials: string;
  hue: number; // the kid's color (see kid-palette.ts)
  greeting: string;
  // Approvals the kid hasn't celebrated yet (on any device).
  pendingCelebration: RecentApproval[];
};

// Columns added by migration v2_0009: until it's run, behave as before
// (default color, nothing waiting to celebrate) rather than break the page.
const missingColumn = (code?: string) => code === "42703" || code === "PGRST204";

export async function getKidHome(ctx: KidContext): Promise<KidHome | null> {
  const view = await getKidTodayView(ctx);
  if (!view) return null;
  const [streaks, household, initialsByKid, hue, pendingCelebration, lastActiveOn] = await Promise.all([
    getKidStreaks(ctx),
    supabaseV2Admin.from("households").select("name").eq("id", ctx.householdId).maybeSingle(),
    getKidInitials(ctx.householdId),
    getKidHue(ctx.kidProfileId),
    getUncelebrated(ctx),
    getLastActiveOn(ctx),
  ]);
  const arcade = await getArcade(ctx, streaks);

  const today = todayInTimezone(ctx.timezone);
  const hour = Number(localTimeInTimezone(ctx.timezone).slice(0, 2));
  const first = streaks[0];
  const nextMilestone = view.milestones.find((m) => m.points > view.progress);
  const prevPoints = [...view.milestones].reverse().find((m) => m.points <= view.progress)?.points ?? 0;
  const text = greeting({
    name: view.kid.name,
    hour,
    tasksTotal: view.items.length,
    tasksLeft: view.items.filter((i) => i.state === "open").length,
    tasksWaiting: view.items.filter((i) => i.state === "pending").length,
    newApprovals: pendingCelebration.length,
    streak: first
      ? { length: first.run.length, todayDone: first.run.todayDone, daysToGo: first.next.daysToGo, broken: first.broken }
      : null,
    daysInactive: lastActiveOn ? daysBetween(lastActiveOn, today) : null,
    toMilestone: nextMilestone ? (view.progress - prevPoints) / Math.max(1, nextMilestone.points - prevPoints) : null,
    toGoal: view.goal ? view.progress / Math.max(1, view.goal.target_points) : null,
    seed: `${ctx.kidProfileId}:${today}`,
  });

  return {
    view,
    streaks,
    arcade,
    householdName: (household.data?.name as string | undefined) ?? "",
    initials: initialsByKid[ctx.kidProfileId] ?? "",
    hue,
    greeting: text,
    pendingCelebration,
  };
}

export async function getKidHue(kidProfileId: string): Promise<number> {
  const { data, error } = await supabaseV2Admin.from("kid_profiles").select("hue").eq("id", kidProfileId).maybeSingle();
  if (error) {
    if (missingColumn(error.code)) return normalizeHue(null);
    throw error;
  }
  return normalizeHue(data?.hue as number | null);
}

export async function setKidHue(ctx: KidContext, hue: number): Promise<void> {
  const { error } = await supabaseV2Admin
    .from("kid_profiles")
    .update({ hue: normalizeHue(hue) })
    .eq("id", ctx.kidProfileId)
    .eq("household_id", ctx.householdId);
  if (error) throw error;
}

async function getUncelebrated(ctx: KidContext): Promise<RecentApproval[]> {
  const { data, error } = await supabaseV2Admin
    .from("completions")
    .select("id, task_name_snapshot, points_snapshot, is_bonus")
    .eq("household_id", ctx.householdId)
    .eq("kid_profile_id", ctx.kidProfileId)
    .eq("status", "approved")
    .is("celebrated_at", null)
    .order("completed_at", { ascending: true })
    .limit(50);
  if (error) {
    if (missingColumn(error.code)) return [];
    throw error;
  }
  return (data ?? []).map((c) => ({
    id: c.id as string,
    name: c.task_name_snapshot as string,
    points: c.points_snapshot as number,
    isBonus: c.is_bonus as boolean,
  }));
}

// Marks approvals as celebrated (the kid played their celebration).
export async function markCelebrated(ctx: KidContext, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabaseV2Admin
    .from("completions")
    .update({ celebrated_at: new Date().toISOString() })
    .eq("household_id", ctx.householdId)
    .eq("kid_profile_id", ctx.kidProfileId)
    .in("id", ids.slice(0, 100))
    .is("celebrated_at", null);
  if (error && !missingColumn(error.code)) throw error;
}

// The last day the kid did a task (bonuses a parent gave don't count).
async function getLastActiveOn(ctx: KidContext): Promise<string | null> {
  const { data, error } = await supabaseV2Admin
    .from("completions")
    .select("completed_on")
    .eq("household_id", ctx.householdId)
    .eq("kid_profile_id", ctx.kidProfileId)
    .not("task_id", "is", null)
    .order("completed_on", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.completed_on as string | undefined) ?? null;
}

const daysBetween = (a: string, b: string) =>
  Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86_400_000);
