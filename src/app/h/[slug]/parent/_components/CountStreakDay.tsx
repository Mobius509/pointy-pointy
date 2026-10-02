"use client";

import { useState, useTransition } from "react";
import { countStreakDayAction } from "../_actions/streaks";

export type StreakLine = {
  id: string;
  name: string;
  days: number;
  needed: number;
  excusedToday: boolean;
  excusedYesterday: boolean;
  canCountToday: boolean;
  canCountYesterday: boolean;
};

// "Count this day": approve today's (or yesterday's) streak day for a kid
// even though its tasks weren't all done — a sick day, a holiday — or undo
// it. Shown beside the streak on the kid's card.
export function CountStreakDay({ slug, kidId, streak }: { slug: string; kidId: string; streak: StreakLine }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const act = (which: "today" | "yesterday", counted: boolean) =>
    start(async () => {
      setError(null);
      const res = await countStreakDayAction(slug, kidId, streak.id, which, counted);
      if (!res.ok) setError(res.error);
    });
  const pill =
    "rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition disabled:opacity-50";
  const day = (which: "today" | "yesterday", excused: boolean, can: boolean) =>
    excused ? (
      <button
        key={which}
        type="button"
        disabled={pending}
        onClick={() => act(which, false)}
        className={`${pill} bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
        title={`Stop counting ${which} for ${streak.name}`}
      >
        {which === "today" ? "Today" : "Yesterday"} counted ✓ · undo
      </button>
    ) : can ? (
      <button
        key={which}
        type="button"
        disabled={pending}
        onClick={() => act(which, true)}
        className={`${pill} bg-pp-tint text-pp-primary hover:bg-pp-tint-hover`}
        title={`Count ${which} for ${streak.name} even though not every task was done`}
      >
        ✓ Count {which}
      </button>
    ) : null;
  return (
    <>
      {day("yesterday", streak.excusedYesterday, streak.canCountYesterday)}
      {day("today", streak.excusedToday, streak.canCountToday)}
      {error && <span className="text-[11px] text-rose-600">{error}</span>}
    </>
  );
}
