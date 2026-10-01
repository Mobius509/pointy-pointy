import type { ChecklistItem } from "@/lib/v2/kid-ops";
import type { KidStreak } from "@/lib/v2/streaks";

// The kid's streaks: how many days in a row, dots toward the next reward,
// and what's left to do today to keep each one going.
export function KidStreaks({ streaks, items }: { streaks: KidStreak[]; items: ChecklistItem[] }) {
  if (streaks.length === 0) return null;
  const byId = new Map(items.map((i) => [i.id, i]));
  return (
    <section className="bg-white rounded-[32px] p-4 sm:p-6 shadow-sm">
      <h2 className="text-pp-primary-strong font-semibold text-[16px]">🔥 Streaks</h2>
      <ul className="mt-3 space-y-4">
        {streaks.map(({ streak, run, next }) => {
          const n = streak.days_required;
          // Dots toward the next reward (all lit on the day one's earned).
          const lit = run.length > 0 && run.length % n === 0 ? n : run.length % n;
          const tasks = streak.taskIds.map((id) => byId.get(id)).filter(Boolean) as ChecklistItem[];
          const todo = tasks.filter((t) => t.state === "open").map((t) => t.name);
          const waiting = tasks.some((t) => t.state === "pending");
          return (
            <li key={streak.id} className="rounded-2xl bg-pp-soft p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-semibold text-pp-primary-strong">{streak.name}</p>
                <p className="text-pp-primary font-bold tabular-nums whitespace-nowrap">
                  🔥 {run.length} {streak.skip_weekends ? "school " : ""}day{run.length === 1 ? "" : "s"}
                </p>
              </div>
              {n <= 14 ? (
                <div className="mt-2 flex flex-wrap gap-1.5" aria-label={`${lit} of ${n} days`}>
                  {Array.from({ length: n }, (_, i) => (
                    <span
                      key={i}
                      className={`size-3.5 rounded-full ${i < lit ? "bg-pp-primary" : "bg-white ring-1 ring-pp-line"}`}
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-2 h-2 rounded-full bg-white ring-1 ring-pp-line overflow-hidden">
                  <div className="h-full bg-pp-primary" style={{ width: `${(lit / n) * 100}%` }} />
                </div>
              )}
              <p className="mt-2 text-[13px] text-pp-muted">
                {next.daysToGo} more day{next.daysToGo === 1 ? "" : "s"} → +{streak.bonus_points} pts &amp; 🎟️ arcade
                ticket
              </p>
              <p className="mt-1 text-[13px] font-semibold text-pp-primary">
                {run.restDay
                  ? "It's the weekend — no streak today 🎉"
                  : run.todayDone
                  ? "Today's done ✓"
                  : todo.length
                    ? `Do ${todo.join(" + ")} today to keep it going!`
                    : waiting
                      ? "Waiting for approval ⏳"
                      : "Keep it going today!"}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
