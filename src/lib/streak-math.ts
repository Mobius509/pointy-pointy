// Streak arithmetic, kept free of the database so it's easy to reason
// about (and test). Dates are YYYY-MM-DD in the family's timezone.
import { addDays } from "./time";

export type StreakRun = {
  length: number; // days in a row, counting today if today is done
  days: string[]; // the counted days, oldest first
  start: string | null; // first day of the run
  todayDone: boolean;
  restDay: boolean; // today is a weekend and the streak skips weekends
  todayLeft: string[]; // task ids not done today (any of them can count)
  todayToGo: number; // how many more of them today needs
};

// Saturday or Sunday (dates are calendar days, so UTC noon is safe).
export const isWeekend = (day: string) => [0, 6].includes(new Date(`${day}T12:00:00Z`).getUTCDay());

export type StreakDayRules = {
  skipWeekends?: boolean;
  tasksNeeded?: number | null; // how many of the tasks make a day (null: all of them)
  excused?: Set<string>; // days a parent counted anyway
};

// The streak's rule for a day: whether it's a rest day (a weekend with "skip
// weekends" — neither counts nor breaks the run), how many of its tasks
// were done, and whether that's enough (or a parent counted it).
export function streakDay(
  taskIds: string[],
  doneDays: Map<string, Set<string>>, // task id → days it was done (approved)
  { skipWeekends = false, tasksNeeded = null, excused = new Set() }: StreakDayRules = {},
) {
  const need = taskIds.length ? Math.min(tasksNeeded ?? taskIds.length, taskIds.length) : 0;
  const doneCount = (day: string) => taskIds.filter((t) => doneDays.get(t)?.has(day)).length;
  const rest = (day: string) => skipWeekends && isWeekend(day);
  const done = (day: string) => excused.has(day) || (need > 0 && doneCount(day) >= need);
  return { need, doneCount, rest, done };
}

// A day counts when enough of its tasks are done (above). The run is
// counted back from today when today is done, otherwise from yesterday — so
// the streak stays alive until midnight. Rest days are passed over: Friday
// then Monday is two in a row with "skip weekends".
export function streakRun(
  taskIds: string[],
  doneDays: Map<string, Set<string>>,
  today: string,
  { maxDays = 400, ...rules }: StreakDayRules & { maxDays?: number } = {},
): StreakRun {
  const day0 = streakDay(taskIds, doneDays, rules);
  const restDay = day0.rest(today);
  const todayDone = !restDay && day0.done(today);
  const counted: string[] = [];
  let day = todayDone ? today : addDays(today, -1);
  for (let looked = 0; looked < maxDays; looked++, day = addDays(day, -1)) {
    if (day0.rest(day)) continue;
    if (!day0.done(day)) break;
    counted.push(day);
  }
  counted.reverse();
  return {
    length: counted.length,
    days: counted,
    start: counted[0] ?? null,
    todayDone,
    restDay,
    todayLeft: restDay || todayDone ? [] : taskIds.filter((t) => !doneDays.get(t)?.has(today)),
    todayToGo: restDay || todayDone ? 0 : Math.max(0, day0.need - day0.doneCount(today)),
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
