import type { V2Goal, V2GoalMilestone } from "@/lib/v2/data";
import {
  createMilestoneAction,
  deleteMilestoneAction,
  updateMilestoneAction,
} from "../_actions/milestones";

// Milestone editor rendered nested inside an active goal's card. Parents
// add "small unlocks" (e.g. ice cream at 500 pts on a 5000-pt dog goal);
// the kid sees them on their progress bar as named dots that light up as
// they pass. No outer section wrapper — the parent goal card already
// provides the card chrome.
export function MilestonesManager({
  slug,
  goal,
  progress,
  milestones,
}: {
  slug: string;
  goal: V2Goal;
  progress: number;
  milestones: V2GoalMilestone[];
}) {
  return (
    <div>
      <h3
        className="text-[#B64B11]"
        style={{ fontSize: 14, fontWeight: 600 }}
      >
        Milestones
      </h3>
      <p className="text-[#C3A38A] mt-1 text-[12px]">
        Add small rewards along the way to {goal.name.toLowerCase()}. They
        show as dots on the progress bar — they light up when reached.
      </p>

      {milestones.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {milestones.map((m) => {
            const unlocked = progress >= m.points;
            return (
              <li
                key={m.id}
                className="rounded-2xl ring-1 ring-[#F1D1BD]/70 bg-[#FFFDF9] p-3 min-w-0"
              >
                <form
                  action={updateMilestoneAction}
                  className="grid gap-2 sm:grid-cols-[1fr_8rem_auto_auto] sm:items-end"
                >
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={m.id} />
                  <div className="min-w-0">
                    <label className="label-warm">Reward</label>
                    <input
                      name="name"
                      defaultValue={m.name}
                      required
                      maxLength={60}
                      className="input-warm w-full"
                      placeholder="Ice cream"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="label-warm">Points</label>
                    <input
                      name="points"
                      type="number"
                      min={1}
                      max={goal.target_points - 1}
                      defaultValue={m.points}
                      required
                      className="input-warm w-full"
                    />
                  </div>
                  <button type="submit" className="btn-warm-secondary">
                    Save
                  </button>
                  <span
                    className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-[12px] font-semibold ${
                      unlocked
                        ? "bg-[#D1FAE5] text-[#065F46]"
                        : "bg-[#FBE3CF] text-[#F2662A]"
                    }`}
                  >
                    {unlocked ? "Unlocked" : "Locked"}
                  </span>
                </form>
                <form action={deleteMilestoneAction} className="mt-2">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={m.id} />
                  <button
                    type="submit"
                    className="text-xs text-rose-600 hover:underline"
                  >
                    Remove milestone
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 text-slate-500 italic">
          No milestones yet. Add the first one below.
        </p>
      )}

      <form
        action={createMilestoneAction}
        className="mt-4 grid gap-2 sm:grid-cols-[1fr_8rem_auto] sm:items-end"
      >
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="goal_id" value={goal.id} />
        <div className="min-w-0">
          <label className="label-warm" htmlFor="ms-new-name">
            Reward
          </label>
          <input
            id="ms-new-name"
            name="name"
            required
            maxLength={60}
            className="input-warm w-full"
            placeholder="Ice cream"
          />
        </div>
        <div className="min-w-0">
          <label className="label-warm" htmlFor="ms-new-points">
            Points
          </label>
          <input
            id="ms-new-points"
            name="points"
            type="number"
            min={1}
            max={goal.target_points - 1}
            required
            className="input-warm w-full"
            placeholder="500"
          />
        </div>
        <button type="submit" className="btn-warm-primary">
          Add milestone
        </button>
      </form>
    </div>
  );
}
