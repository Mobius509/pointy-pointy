import "server-only";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { addDays, todayInTimezone } from "@/lib/time";
import { ARCADE_GAMES, isArcadeGame, type ArcadeGameId } from "@/lib/games";
import { arcadeMode, nextReward, rewardSteps, streakRun, type ArcadeMode, type StreakRun } from "@/lib/streak-math";
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
// bonus points, an arcade ticket (its `tier` records which reward of the
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
//
// Tickets pile up; each one is a single play. Using one starts a game
// (random, or the kid's pick once a streak has run two weeks) and needs a
// streak going. The ticket is burned when the kid closes the game — until
// then (say the page reloads) that game is still theirs to play.
// Columns: `claimed_at` = used, `games` = [the game], `expires_at` = closed.

export type Arcade = {
  tickets: number; // unused tickets
  mode: ArcadeMode; // what using one does right now
  streakDays: number; // best current streak
  pickAt: number; // streak days that let the kid pick the game
  playing: { ticketId: string; game: ArcadeGameId } | null; // used, not closed yet
};

const modeFor = (streaks: KidStreak[]) =>
  arcadeMode(streaks.map((s) => ({ length: s.run.length, skipWeekends: !!s.streak.skip_weekends })));

export async function getArcade(ctx: KidContext, streaks?: KidStreak[]): Promise<Arcade> {
  const [{ data, error }, kidStreaks] = await Promise.all([
    supabaseV2Admin
      .from("arcade_tickets")
      .select("id, games, claimed_at")
      .eq("household_id", ctx.householdId)
      .eq("kid_profile_id", ctx.kidProfileId)
      .is("expires_at", null)
      .order("created_at"),
    streaks ?? getKidStreaks(ctx),
  ]);
  const mode = modeFor(kidStreaks);
  if (error) {
    if (notSetUp(error.code)) return { tickets: 0, playing: null, ...mode };
    throw error;
  }
  let playing: Arcade["playing"] = null;
  let tickets = 0;
  for (const t of data ?? []) {
    const game = (t.games as string[] | null)?.[0];
    if (!t.claimed_at) tickets++;
    else if (!playing && game && isArcadeGame(game)) playing = { ticketId: t.id as string, game };
  }
  return { tickets, playing, ...mode };
}

// Redeems a ticket: picks the game (random, or `picked` when the streak allows
// choosing) and marks the ticket used. A game already in progress comes
// back instead of spending another ticket.
export async function redeemArcadeTicket(
  ctx: KidContext,
  picked: string | null,
): Promise<{ ok: true; ticketId: string; game: ArcadeGameId } | { ok: false; error: string }> {
  const arcade = await getArcade(ctx);
  if (arcade.playing) return { ok: true, ...arcade.playing };
  if (arcade.tickets === 0) return { ok: false, error: "No tickets left — keep your streak going to earn more!" };
  if (arcade.mode === "locked") return { ok: false, error: "Start a streak to use your tickets!" };

  let game: ArcadeGameId;
  if (arcade.mode === "pick") {
    if (!picked || !isArcadeGame(picked)) return { ok: false, error: "Pick a game." };
    game = picked;
  } else {
    game = ARCADE_GAMES[Math.floor(Math.random() * ARCADE_GAMES.length)].id;
  }

  const { data: next, error } = await supabaseV2Admin
    .from("arcade_tickets")
    .select("id")
    .eq("household_id", ctx.householdId)
    .eq("kid_profile_id", ctx.kidProfileId)
    .is("claimed_at", null)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!next) return { ok: false, error: "No tickets left." };
  const { data: used, error: useError } = await supabaseV2Admin
    .from("arcade_tickets")
    .update({ games: [game], claimed_at: new Date().toISOString() })
    .eq("id", next.id)
    .is("claimed_at", null) // no double-spending from two taps
    .select("id");
  if (useError) return { ok: false, error: useError.message };
  if (!used?.length) return { ok: false, error: "That ticket's already been used — try again." };
  return { ok: true, ticketId: next.id as string, game };
}

// Closing the game burns the ticket.
export async function finishArcadeTicket(ctx: KidContext, ticketId: string): Promise<void> {
  const { error } = await supabaseV2Admin
    .from("arcade_tickets")
    .update({ expires_at: new Date().toISOString() })
    .eq("id", ticketId)
    .eq("household_id", ctx.householdId)
    .eq("kid_profile_id", ctx.kidProfileId)
    .not("claimed_at", "is", null)
    .is("expires_at", null);
  if (error) throw error;
}
