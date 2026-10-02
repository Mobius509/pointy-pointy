// Streak arithmetic, kept free of the database so it's easy to reason
// about (and test). Dates are YYYY-MM-DD in the family's timezone.
import { addDays } from "./time";

export type StreakRun = {
  length: number; // days in a row, counting today if today is done
  days: string[]; // the counted days, oldest first
  start: string | null; // first day of the run
  todayDone: boolean;
  restDay: boolean; // today is a weekend and the streak skips weekends
  todayLeft: string[]; // task ids still to do today
};

// Saturday or Sunday (dates are calendar days, so UTC noon is safe).
export const isWeekend = (day: string) => [0, 6].includes(new Date(`${day}T12:00:00Z`).getUTCDay());

// A day counts when every task in the streak has an approved completion
// for it. The run is counted back from today when today is done, otherwise
// from yesterday — so the streak stays alive until midnight. With
// `skipWeekends`, Saturdays and Sundays are passed over: they neither
// count nor break the run (Friday then Monday is two in a row).
export function streakRun(
  taskIds: string[],
  doneDays: Map<string, Set<string>>, // task id → days it was done (approved)
  today: string,
  { skipWeekends = false, maxDays = 400 } = {},
): StreakRun {
  const done = (task: string, day: string) => doneDays.get(task)?.has(day) ?? false;
  const dayComplete = (day: string) => taskIds.length > 0 && taskIds.every((t) => done(t, day));
  const skipped = (day: string) => skipWeekends && isWeekend(day);
  const restDay = skipped(today);
  const todayDone = !restDay && dayComplete(today);
  const counted: string[] = [];
  let day = todayDone ? today : addDays(today, -1);
  for (let looked = 0; looked < maxDays; looked++, day = addDays(day, -1)) {
    if (skipped(day)) continue;
    if (!dayComplete(day)) break;
    counted.push(day);
  }
  counted.reverse();
  return {
    length: counted.length,
    days: counted,
    start: counted[0] ?? null,
    todayDone,
    restDay,
    todayLeft: restDay ? [] : taskIds.filter((t) => !done(t, today)),
  };
}

// Every reward the run has reached: at N, 2N, 3N… counted days. `number` is
// stored as the arcade ticket's tier (no longer used for anything).
export function rewardSteps(run: StreakRun, daysRequired: number): { number: number; reachedOn: string }[] {
  if (daysRequired < 1) return [];
  const steps = [];
  for (let k = 1; k * daysRequired <= run.length; k++) {
    steps.push({ number: k, reachedOn: run.days[k * daysRequired - 1] });
  }
  return steps;
}

// The next reward: which day count it's at and how many more days.
export function nextReward(run: StreakRun, daysRequired: number) {
  const at = (Math.floor(run.length / daysRequired) + 1) * daysRequired;
  return { at, daysToGo: at - run.length };
}

// What using an arcade ticket does right now, from the kid's best current
// streak: nothing without a streak going, a random game once there is one,
// and their pick of game after two weeks in a row (two school weeks — 10
// days — for a streak that skips weekends).
export type ArcadeMode = "locked" | "random" | "pick";
export function arcadeMode(runs: { length: number; skipWeekends: boolean }[]): {
  mode: ArcadeMode;
  streakDays: number;
  pickAt: number;
} {
  let best = 0;
  let pickAt = 14;
  let pick = false;
  for (const r of runs) {
    const need = r.skipWeekends ? 10 : 14;
    if (r.length >= need) pick = true;
    if (r.length > best) {
      best = r.length;
      pickAt = need;
    }
  }
  return { mode: pick ? "pick" : best > 0 ? "random" : "locked", streakDays: best, pickAt };
}

// This week (Monday on) for the streak card's dots: each day done, missed,
// today (not done yet) or still to come. Weekends are left out of a streak
// that skips them.
export type WeekDay = { day: string; state: "done" | "missed" | "today" | "upcoming" };
export function streakWeek(
  taskIds: string[],
  doneDays: Map<string, Set<string>>,
  today: string,
  { skipWeekends = false } = {},
): WeekDay[] {
  const done = (day: string) => taskIds.length > 0 && taskIds.every((t) => doneDays.get(t)?.has(day));
  const dow = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  const monday = addDays(today, -dow);
  const week: WeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const day = addDays(monday, i);
    if (skipWeekends && isWeekend(day)) continue;
    week.push({
      day,
      state: done(day) ? "done" : day < today ? "missed" : day === today ? "today" : "upcoming",
    });
  }
  return week;
}

// The streak just ended: no run now, but there was one that finished in
// the last few (counted) days — for the "you lost your streak" greeting.
export function brokeRecently(
  taskIds: string[],
  doneDays: Map<string, Set<string>>,
  today: string,
  { skipWeekends = false, within = 3 } = {},
): boolean {
  let day = addDays(today, -1);
  for (let counted = 0; counted < within; day = addDays(day, -1)) {
    if (skipWeekends && isWeekend(day)) continue;
    counted++;
    if (taskIds.length > 0 && taskIds.every((t) => doneDays.get(t)?.has(day))) return true;
  }
  return false;
}
