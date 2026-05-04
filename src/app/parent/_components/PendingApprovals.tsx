import type { Completion } from "@/lib/data";
import {
  approveCompletionAction,
  denyCompletionAction,
} from "../_actions/approvals";

export function PendingApprovals({ items }: { items: Completion[] }) {
  if (items.length === 0) {
    return (
      <section className="card">
        <h3 className="text-lg font-bold text-slate-800">Pending approvals</h3>
        <p className="text-sm text-slate-500 italic mt-1">
          No tasks waiting. When she taps a task, it&apos;ll appear here for
          you to confirm.
        </p>
      </section>
    );
  }

  return (
    <section className="card ring-2 ring-amber-300 bg-amber-50/60">
      <h3 className="text-lg font-bold text-amber-900">
        Pending approvals · {items.length}
      </h3>
      <ul className="mt-3 space-y-2">
        {items.map((c) => (
          <li
            key={c.id}
            className="rounded-xl bg-white ring-1 ring-amber-200 p-3 flex flex-col sm:flex-row sm:items-center gap-3"
          >
            <span className="flex-1 min-w-0 flex items-center gap-3">
              <span className="flex-1 min-w-0">
                <span className="font-semibold block truncate">
                  ⏳ {c.task_name_snapshot}
                </span>
                <span className="block text-xs text-slate-500">
                  Submitted{" "}
                  {new Date(c.completed_at).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </span>
              <span className="flex-shrink-0 rounded-full bg-brand-100 text-brand-700 px-3 py-1 text-sm font-bold tabular-nums">
                +{c.points_snapshot}
              </span>
            </span>
            <div className="flex gap-2 sm:flex-shrink-0">
              <form action={approveCompletionAction} className="flex-1 sm:flex-none">
                <input type="hidden" name="id" value={c.id} />
                <button type="submit" className="btn-primary w-full sm:w-auto">
                  Approve
                </button>
              </form>
              <form action={denyCompletionAction} className="flex-1 sm:flex-none">
                <input type="hidden" name="id" value={c.id} />
                <button type="submit" className="btn-secondary w-full sm:w-auto">
                  Deny
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
