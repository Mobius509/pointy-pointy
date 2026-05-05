import { getActiveGoal, getAllGoals, getGoalProgress } from "@/lib/data";
import {
  redeemGoalAction,
  startNewGoalAction,
  updateGoalAction,
} from "../_actions/goal";

export const dynamic = "force-dynamic";

export default async function GoalPage() {
  const active = await getActiveGoal();
  const all = await getAllGoals();
  const progress = active ? await getGoalProgress(active) : 0;

  return (
    <div className="space-y-4">
      {active ? (
        <section className="card">
          <h2 className="text-lg font-bold text-slate-800">Active goal</h2>
          <form
            action={updateGoalAction}
            className="mt-3 grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end"
          >
            <input type="hidden" name="id" value={active.id} />
            <div>
              <label className="label">Name</label>
              <input
                name="name"
                defaultValue={active.name}
                required
                className="input"
              />
            </div>
            <div>
              <label className="label">Target points</label>
              <input
                name="target_points"
                type="number"
                min={1}
                max={1_000_000}
                defaultValue={active.target_points}
                required
                className="input"
              />
            </div>
            <button type="submit" className="btn-secondary">
              Save
            </button>
          </form>
          <div className="mt-3 text-sm text-slate-600">
            Progress so far:{" "}
            <span className="font-semibold tabular-nums">
              {progress.toLocaleString()} / {active.target_points.toLocaleString()}
            </span>
          </div>
          <form action={redeemGoalAction} className="mt-3">
            <input type="hidden" name="id" value={active.id} />
            <button type="submit" className="btn-danger">
              Mark redeemed (archive)
            </button>
          </form>
        </section>
      ) : (
        <section className="card">
          <h2 className="text-lg font-bold text-slate-800">No active goal</h2>
          <p className="text-sm text-slate-600 mt-1">Start a new one below.</p>
        </section>
      )}

      <section className="card">
        <h2 className="text-lg font-bold text-slate-800">Start a new goal</h2>
        <p className="text-sm text-slate-600 mt-1">
          Closes any active goal and starts fresh. Past completions stay in the
          activity log.
        </p>
        <form
          action={startNewGoalAction}
          className="mt-3 grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end"
        >
          <div>
            <label className="label">Name</label>
            <input
              name="name"
              required
              className="input"
              placeholder="Trip to the trampoline park"
            />
          </div>
          <div>
            <label className="label">Target points</label>
            <input
              name="target_points"
              type="number"
              min={1}
              max={1_000_000}
              defaultValue={1000}
              required
              className="input"
            />
          </div>
          <button type="submit" className="btn-primary">
            Start goal
          </button>
        </form>
      </section>

      <section className="card">
        <h2 className="text-lg font-bold text-slate-800 mb-2">Goal history</h2>
        {all.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No goals yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {all.map((g) => (
              <li
                key={g.id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span className="min-w-0">
                  <span className="font-medium">{g.name}</span>
                  <span className="block text-xs text-slate-500">
                    Started {new Date(g.started_at).toLocaleDateString()}
                    {g.redeemed_at &&
                      ` · Redeemed ${new Date(g.redeemed_at).toLocaleDateString()}`}
                  </span>
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {g.target_points.toLocaleString()} pts
                  {!g.redeemed_at && (
                    <span className="ml-2 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs">
                      active
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
