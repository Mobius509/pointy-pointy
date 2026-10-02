"use client";

import { useState, useTransition } from "react";
import { countStreakDayAction } from "../_actions/streaks";

export type StreakLine = {
  id: string;
  name: string;
  days: number;
  needed: number;
  today: string; // YYYY-MM-DD, family's timezone
  excusedToday: boolean;
  canCountToday: boolean;
  missedDay: string | null; // the latest missed day it could still count
  lastExcused: string | null; // the latest day a parent counted
};

// "Count this day": approve a streak day for a kid even though not enough of
// its tasks were done — today, or the latest missed day in the last two
// weeks (a sick day, a holiday, a late catch-up). Counting a missed day
// mends the streak; if there's an earlier miss, it shows up next. Undo
// takes back the latest one counted.
export function CountStreakDay({ slug, kidId, streak }: { slug: string; kidId: string; streak: StreakLine }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const act = (day: string, counted: boolean) =>
    start(async () => {
      setError(null);
      const res = await countStreakDayAction(slug, kidId, streak.id, day, counted);
      if (!res.ok) setError(res.error);
    });
  const pill = "rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition disabled:opacity-50";
  const label = (day: string) => dayLabel(day, streak.today);
  return (
    <>
      {streak.missedDay && (
        <button
          type="button"
          disabled={pending}
          onClick={() => act(streak.missedDay!, true)}
          className={`${pill} bg-pp-tint text-pp-primary hover:bg-pp-tint-hover`}
          title={`Count ${label(streak.missedDay)} for ${streak.name} even though not enough tasks were done`}
        >
          ✓ Count {label(streak.missedDay)}
        </button>
      )}
      {streak.canCountToday && (
        <button
          type="button"
          disabled={pending}
          onClick={() => act(streak.today, true)}
          className={`${pill} bg-pp-tint text-pp-primary hover:bg-pp-tint-hover`}
          title={`Count today for ${streak.name} even though not enough tasks were done`}
        >
          ✓ Count today
        </button>
      )}
      {streak.lastExcused && (
        <button
          type="button"
          disabled={pending}
          onClick={() => act(streak.lastExcused!, false)}
          className={`${pill} bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
          title={`Stop counting ${label(streak.lastExcused)} for ${streak.name}`}
        >
          {label(streak.lastExcused)} counted ✓ · undo
        </button>
      )}
      {error && <span className="text-[11px] text-rose-600">{error}</span>}
    </>
  );
}

// "today", "yesterday", or "Tue Sep 29".
function dayLabel(day: string, today: string): string {
  if (day === today) return "today";
  const d = new Date(`${day}T12:00:00Z`);
  const t = new Date(`${today}T12:00:00Z`);
  if (Math.round((t.getTime() - d.getTime()) / 86_400_000) === 1) return "yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}
