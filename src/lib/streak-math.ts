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

// Which weekdays a streak task is needed: a bitmask, bit 0 = Monday … bit 6
// = Sunday (streak_tasks.days). EVERY_DAY = all seven.
export const EVERY_DAY = 127;
export const weekdayBit = (day: string) => 1 << ((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7);

export type StreakDayRules = {
  skipWeekends?: boolean;
  taskDays?: Record<string, number>; // task id → weekday bitmask (missing = every day)
  excused?: Set<string>; // days a parent counted anyway
};

// The streak's rule for a day: which tasks it needs, whether it's a rest day
// (a weekend with "skip weekends", or no task needed that day — it neither
// counts nor breaks the run), and whether it's done (every needed task
// approved, or a parent counted it).
export function streakDay(
  taskIds: string[],
  doneDays: Map<string, Set<string>>, // task id → days it was done (approved)
  { skipWeekends = false, taskDays = {}, excused = new Set() }: StreakDayRules = {},
) {
  const needed = (day: string) => {
    const bit = weekdayBit(day);
    return taskIds.filter((t) => ((taskDays[t] ?? EVERY_DAY) & bit) !== 0);
  };
  const rest = (day: string) => (skipWeekends && isWeekend(day)) || needed(day).length === 0;
  const done = (day: string) =>
    excused.has(day) || (needed(day).length > 0 && needed(day).every((t) => doneDays.get(t)?.has(day)));
  return { needed, rest, done };
}

// A day counts when it's done (above). The run is counted back from today
// when today is done, otherwise from yesterday — so the streak stays alive
// until midnight. Rest days are passed over: Friday then Monday is two in a
// row with "skip weekends", and a Friday with nothing needed doesn't break it.
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
    todayLeft:
      restDay || todayDone ? [] : day0.needed(today).filter((t) => !doneDays.get(t)?.has(today)),
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
