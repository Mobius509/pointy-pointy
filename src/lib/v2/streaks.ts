import "server-only";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { addDays, todayInTimezone } from "@/lib/time";
import { ARCADE_GAMES, isArcadeGame, type ArcadeGameId } from "@/lib/games";
import { nextReward, rewardSteps, streakRun, ticketSlots, type StreakRun } from "@/lib/streak-math";
import { insertBonusCompletion } from "@/lib/v2/bonus";
import { notifyStreakReward } from "@/lib/v2/push";
import type { KidContext } from "@/lib/v2/kid-ops";

// Streaks (parent-defined sets of daily tasks to do N days in a row) and
// the arcade tickets they earn. See supabase/migrations/v2_0008_streaks.sql.

export type Streak = {
  id: string;
  name: string;
  days_required: number;
  bonus_points: number;
  skip_weekends: boolean;
  active: boolean;
  sort_order: number;
  created_at: string;
  taskIds: string[];
};

export type KidStreak = {
  streak: Streak;
  run: StreakRun;
  next: { at: number; daysToGo: number };
};

// Before the streaks migration is run there are no tables — no streaks,
// rather than a broken page.
const notSetUp = (code?: string) => code === "42P01" || code === "PGRST205";
const HISTORY_DAYS = 400;
const TICKET_HOURS = 24;

export async function getStreaks(householdId: string, { activeOnly = false } = {}): Promise<Streak[]> {
  let q = supabaseV2Admin
    .from("streaks")
    .select("*, streak_tasks(task_id)")
    .eq("household_id", householdId)
    .order("sort_order")
    .order("created_at");
  if (activeOnly) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) {
    if (notSetUp(error.code)) return [];
    throw error;
  }
  type Row = Omit<Streak, "taskIds"> & { streak_tasks: { task_id: string }[] | null };
  return ((data ?? []) as Row[]).map(({ streak_tasks, ...rest }) => ({
    ...rest,
    skip_weekends: !!rest.skip_weekends,
    taskIds: (streak_tasks ?? []).map((t) => t.task_id),
  }));
}

// Days each task was done (approved), from the daily period keys.
async function doneDays(ctx: KidContext, taskIds: string[], today: string) {
  const days = new Map<string, Set<string>>();
  if (taskIds.length === 0) return days;
  const { data, error } = await supabaseV2Admin
    .from("completions")
    .select("task_id, period_key")
    .eq("household_id", ctx.householdId)
    .eq("kid_profile_id", ctx.kidProfileId)
    .eq("status", "approved")
    .in("task_id", taskIds)
    .gte("completed_on", addDays(today, -HISTORY_DAYS));
  if (error) throw error;
  for (const r of data ?? []) {
    const key = r.period_key as string | null;
    if (!key?.startsWith("D-")) continue;
    const task = r.task_id as string;
    if (!days.has(task)) days.set(task, new Set());
    days.get(task)!.add(key.slice(2));
  }
  return days;
}

// Each active streak for a kid: the current run and the next reward.
export async function getKidStreaks(ctx: KidContext): Promise<KidStreak[]> {
  const streaks = (await getStreaks(ctx.householdId, { activeOnly: true })).filter((s) => s.taskIds.length);
  if (!streaks.length) return [];
  const today = todayInTimezone(ctx.timezone);
  const days = await doneDays(ctx, [...new Set(streaks.flatMap((s) => s.taskIds))], today);
  return streaks.map((streak) => {
    const run = streakRun(streak.taskIds, days, today, { skipWeekends: !!streak.skip_weekends });
    return { streak, run, next: nextReward(run, streak.days_required) };
  });
}

// Pays any rewards a kid's streaks have reached and not been paid for:
// bonus points, an arcade ticket (tier = which reward of this unbroken
// run), and a notification. Safe to call any number of times — each reward
// is keyed by the day it was reached. Rewards reached before a streak was
// set up don't pay out (the days still count toward the next one).
export async function checkStreakRewards(ctx: KidContext): Promise<void> {
  const kidStreaks = await getKidStreaks(ctx);
  for (const { streak, run } of kidStreaks) {
    const created = todayInTimezone(ctx.timezone, new Date(streak.created_at));
    for (const step of rewardSteps(run, streak.days_required)) {
      if (step.reachedOn < created) continue;
      const { data: inserted, error } = await supabaseV2Admin
        .from("streak_rewards")
        .upsert(
          {
            household_id: ctx.householdId,
            streak_id: streak.id,
            kid_profile_id: ctx.kidProfileId,
            reached_on: step.reachedOn,
            reward_number: step.number,
          },
          { onConflict: "streak_id,kid_profile_id,reached_on", ignoreDuplicates: true },
        )
        .select("id");
      if (error) throw error;
      const rewardId = inserted?.[0]?.id as string | undefined;
      if (!rewardId) continue; // already paid

      const days = step.number * streak.days_required;
      if (streak.bonus_points > 0) {
        const completionId = await insertBonusCompletion({
          householdId: ctx.householdId,
          kidProfileId: ctx.kidProfileId,
          timezone: ctx.timezone,
          name: `🔥 ${days}-day streak: ${streak.name}`,
          points: streak.bonus_points,
        });
        await supabaseV2Admin.from("streak_rewards").update({ completion_id: completionId }).eq("id", rewardId);
      }
      await supabaseV2Admin.from("arcade_tickets").insert({
        household_id: ctx.householdId,
        kid_profile_id: ctx.kidProfileId,
        streak_reward_id: rewardId,
        tier: step.number,
      });
      notifyStreakReward(ctx.householdId, ctx.kidProfileId, streak.name, days, streak.bonus_points);
    }
  }
}

// ----- Arcade -------------------------------------------------------------------

export type ArcadeTicket = { id: string; tier: number; random: boolean; picks: number };
export type Arcade = {
  unlocked: { game: ArcadeGameId; expiresAt: string }[];
  tickets: ArcadeTicket[]; // waiting to be opened
};

export async function getArcade(ctx: KidContext): Promise<Arcade> {
  const { data, error } = await supabaseV2Admin
    .from("arcade_tickets")
    .select("id, tier, games, claimed_at, expires_at")
    .eq("household_id", ctx.householdId)
    .eq("kid_profile_id", ctx.kidProfileId)
    .or(`claimed_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("created_at");
  if (error) {
    if (notSetUp(error.code)) return { unlocked: [], tickets: [] };
    throw error;
  }
  const expiry = new Map<ArcadeGameId, string>();
  const tickets: ArcadeTicket[] = [];
  for (const t of data ?? []) {
    if (!t.claimed_at) {
      tickets.push({ id: t.id as string, tier: t.tier as number, ...ticketSlots(t.tier as number) });
      continue;
    }
    for (const g of (t.games as string[] | null) ?? []) {
      if (!isArcadeGame(g)) continue;
      const until = t.expires_at as string;
      if (!expiry.has(g) || expiry.get(g)! < until) expiry.set(g, until);
    }
  }
  return {
    unlocked: ARCADE_GAMES.filter((g) => expiry.has(g.id)).map((g) => ({ game: g.id, expiresAt: expiry.get(g.id)! })),
    tickets,
  };
}

// Opens a ticket: tier 1 gets a random game (not one that's already
// unlocked, if possible); higher tiers get the games the kid picked. The
// 24 hours start now.
export async function claimArcadeTicket(
  ctx: KidContext,
  ticketId: string,
  picked: string[],
): Promise<{ ok: true; games: ArcadeGameId[] } | { ok: false; error: string }> {
  const { data: ticket, error } = await supabaseV2Admin
    .from("arcade_tickets")
    .select("id, tier, claimed_at")
    .eq("id", ticketId)
    .eq("household_id", ctx.householdId)
    .eq("kid_profile_id", ctx.kidProfileId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!ticket) return { ok: false, error: "Ticket not found." };
  if (ticket.claimed_at) return { ok: false, error: "That ticket's already been used." };

  const slots = ticketSlots(ticket.tier as number);
  let games: ArcadeGameId[];
  if (slots.random) {
    const current = new Set((await getArcade(ctx)).unlocked.map((u) => u.game));
    const fresh = ARCADE_GAMES.filter((g) => !current.has(g.id));
    const pool = fresh.length ? fresh : ARCADE_GAMES;
    games = [pool[Math.floor(Math.random() * pool.length)].id];
  } else {
    const unique = [...new Set(picked)].filter(isArcadeGame);
    if (unique.length !== slots.picks) return { ok: false, error: `Pick ${slots.picks} game${slots.picks === 1 ? "" : "s"}.` };
    games = unique;
  }

  const now = new Date();
  const { data: claimed, error: claimError } = await supabaseV2Admin
    .from("arcade_tickets")
    .update({
      games,
      claimed_at: now.toISOString(),
      expires_at: new Date(now.getTime() + TICKET_HOURS * 3600_000).toISOString(),
    })
    .eq("id", ticketId)
    .is("claimed_at", null) // no double-claiming from two taps
    .select("id");
  if (claimError) return { ok: false, error: claimError.message };
  if (!claimed?.length) return { ok: false, error: "That ticket's already been used." };
  return { ok: true, games };
}
