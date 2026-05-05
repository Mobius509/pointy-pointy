import type { KidProfile, V2Completion, V2Goal, V2Task } from "@/lib/v2/data";
import { frequencyLabel, type Frequency } from "@/lib/time";
import {
  approveCompletionAction,
  denyCompletionAction,
} from "../_actions/approvals";
import { BonusForKidButton } from "./BonusForKidButton";

type Props = {
  slug: string;
  kid: KidProfile;
  pending: V2Completion[]; // already filtered to this kid
  taskById: Map<string, V2Task>;
  goal: V2Goal | null;
  progress: number;
};

const FREQUENCY_ORDER: Frequency[] = [
  "daily",
  "weekly",
  "biweekly",
  "monthly",
  "yearly",
];

export function KidOverviewCard({
  slug,
  kid,
  pending,
  taskById,
  goal,
  progress,
}: Props) {
  // Group pending items by the originating task's frequency. Bonus suggestions
  // (no task_id) get bucketed under "daily" since that's the default cadence
  // for one-off proposals.
  const grouped = new Map<Frequency, V2Completion[]>();
  for (const c of pending) {
    const freq = (c.task_id ? taskById.get(c.task_id)?.frequency : "daily") ??
      "daily";
    const arr = grouped.get(freq) ?? [];
    arr.push(c);
    grouped.set(freq, arr);
  }

  const goalPct = goal
    ? Math.min(100, Math.round((progress / Math.max(1, goal.target_points)) * 100))
    : 0;

  return (
    <section className="rounded-2xl bg-white p-5 sm:p-6 shadow-sm">
      <div className="grid gap-6 md:grid-cols-[180px_1fr]">
        {/* Left: avatar + points */}
        <div className="flex flex-col items-center md:items-start">
          <div className="size-20 rounded-full bg-amber-100 grid place-items-center text-5xl">
            <span aria-hidden>{kid.avatar_emoji}</span>
          </div>
          <h3 className="mt-3 text-2xl font-extrabold text-orange-700">
            {kid.name}
          </h3>
          <div className="mt-6 text-5xl sm:text-6xl font-extrabold text-orange-300/80 tabular-nums leading-none">
            {progress.toLocaleString()}
          </div>
          <div className="text-xs font-semibold text-orange-700/80 mt-1">
            Current Points
          </div>
        </div>

        {/* Right: pending approvals + Award bonus */}
        <div className="space-y-4">
          {pending.length === 0 ? (
            <div className="text-sm text-slate-500 italic">
              {`Nothing waiting on you. When ${kid.name} taps a task, it'll show up here.`}
            </div>
          ) : (
            FREQUENCY_ORDER.filter((f) => grouped.has(f)).map((freq) => (
              <div key={freq}>
                <span className="inline-block rounded-full bg-amber-100 text-amber-900 px-3 py-1 text-xs font-semibold">
                  {frequencyLabel(freq)}
                </span>
                <ul className="mt-2 divide-y divide-slate-100">
                  {grouped.get(freq)!.map((c) => {
                    const isProposal =
                      c.task_id === null && c.is_bonus;
                    return (
                      <li
                        key={c.id}
                        className="py-3 flex flex-wrap items-center gap-3"
                      >
                        <span className="flex-1 min-w-0">
                          <span className="font-medium text-slate-800 truncate block">
                            {c.task_name_snapshot}
                            {isProposal && (
                              <span className="ml-2 text-xs text-amber-700">
                                · suggested
                              </span>
                            )}
                          </span>
                        </span>

                        <div className="flex gap-2 flex-shrink-0">
                          <form action={denyCompletionAction}>
                            <input type="hidden" name="slug" value={slug} />
                            <input type="hidden" name="id" value={c.id} />
                            <button
                              type="submit"
                              className="rounded-full bg-orange-50 hover:bg-orange-100 text-orange-700 font-semibold px-5 py-1.5 text-sm transition active:scale-[0.99]"
                            >
                              Deny
                            </button>
                          </form>
                          <form
                            action={approveCompletionAction}
                            className="flex items-center gap-2"
                          >
                            <input type="hidden" name="slug" value={slug} />
                            <input type="hidden" name="id" value={c.id} />
                            {isProposal && (
                              <input
                                name="points"
                                type="number"
                                min={0}
                                max={1000}
                                defaultValue={5}
                                required
                                aria-label="Points"
                                className="w-16 rounded-full border-slate-200 bg-white px-2 py-1.5 text-sm text-center ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-400"
                              />
                            )}
                            <button
                              type="submit"
                              className="rounded-full bg-orange-600 hover:bg-orange-700 text-white font-semibold px-5 py-1.5 text-sm transition active:scale-[0.99]"
                            >
                              Approve
                            </button>
                          </form>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}

          <div className="flex justify-end pt-2">
            <BonusForKidButton slug={slug} kid={kid} />
          </div>
        </div>
      </div>

      {/* Goal progress bar — full width across the card */}
      {goal && (
        <div className="mt-6 flex items-center gap-4">
          <span className="text-sm font-semibold text-slate-700 truncate">
            {goal.name}
          </span>
          <div className="flex-1 h-3 rounded-full bg-orange-100 overflow-hidden">
            <div
              className="h-full bg-orange-600 transition-[width] duration-500 ease-out"
              style={{ width: `${goalPct}%` }}
            />
          </div>
          <span className="text-sm font-semibold text-slate-700 tabular-nums">
            {goal.target_points.toLocaleString()}
          </span>
        </div>
      )}
    </section>
  );
}
