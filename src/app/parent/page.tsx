import {
  getActiveGoal,
  getActiveRecurringTasks,
  getGoalProgress,
  getPendingCompletions,
  getRecentCompletions,
  getSettings,
  getTodayCompletions,
} from "@/lib/data";
import { ProgressVisual } from "../_components/ProgressVisual";
import { PendingApprovals } from "./_components/PendingApprovals";

export const dynamic = "force-dynamic";

export default async function ParentOverview() {
  const settings = await getSettings();
  const goal = await getActiveGoal();
  const tasks = await getActiveRecurringTasks();
  const todayCompletions = await getTodayCompletions(settings.timezone);
  const recent = await getRecentCompletions(5);
  const pending = await getPendingCompletions();

  const approvedToday = new Set(
    todayCompletions
      .filter((c) => !c.is_bonus && c.task_id && c.status === "approved")
      .map((c) => c.task_id as string),
  );
  const todayPoints = todayCompletions
    .filter((c) => c.status === "approved" && !c.is_bonus)
    .reduce((sum, c) => sum + c.points_snapshot, 0);
  const dailyPotential = tasks.reduce((sum, t) => sum + t.points, 0);
  const progress = goal ? await getGoalProgress(goal) : 0;

  return (
    <div className="space-y-4">
      {goal && (
        <ProgressVisual
          goalName={goal.name}
          current={progress}
          target={goal.target_points}
        />
      )}

      <PendingApprovals items={pending} />

      <section className="card">
        <h3 className="text-lg font-bold text-slate-800">Today</h3>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <Stat
            label="Points earned today"
            value={`${todayPoints} / ${dailyPotential}`}
          />
          <Stat
            label="Tasks approved today"
            value={`${approvedToday.size} / ${tasks.length}`}
          />
        </div>
      </section>

      <section className="card">
        <h3 className="text-lg font-bold text-slate-800 mb-2">
          Most recent activity
        </h3>
        {recent.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No activity yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.map((c) => {
              const icon =
                c.status === "pending" ? "⏳ " : c.is_bonus ? "⭐ " : "✅ ";
              return (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <span className="truncate">
                    {icon}
                    {c.task_name_snapshot}
                  </span>
                  <span
                    className={`font-semibold tabular-nums ${
                      c.status === "pending"
                        ? "text-amber-700"
                        : "text-brand-700"
                    }`}
                  >
                    +{c.points_snapshot}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-extrabold text-slate-800 tabular-nums">
        {value}
      </div>
    </div>
  );
}
