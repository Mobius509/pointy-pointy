// Streak arithmetic, kept free of the database so it's easy to reason
// about (and test). Dates are YYYY-MM-DD in the family's timezone.
import { addDays } from "./time";
import { ARCADE_GAMES } from "./games";

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
// also the arcade ticket's tier (so a broken run starts back at tier 1).
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

// What a ticket of a given tier unlocks: tier 1 is one random game; tier
// k ≥ 2 lets the kid choose k − 1 games, up to all of them.
export function ticketSlots(tier: number): { random: boolean; picks: number } {
  if (tier <= 1) return { random: true, picks: 1 };
  return { random: false, picks: Math.min(tier - 1, ARCADE_GAMES.length) };
}
