import { getAllCompletions } from "@/lib/data";
import { deleteCompletionAction } from "../_actions/activity";
import {
  approveCompletionAction,
  denyCompletionAction,
} from "../_actions/approvals";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const items = await getAllCompletions(200);

  // Group by completed_on for readability.
  const groups = new Map<string, typeof items>();
  for (const c of items) {
    const arr = groups.get(c.completed_on) ?? [];
    arr.push(c);
    groups.set(c.completed_on, arr);
  }

  return (
    <div className="space-y-4">
      <section className="card">
        <h2 className="text-lg font-bold text-slate-800">Activity log</h2>
        <p className="text-sm text-slate-600 mt-1">
          Up to last 200 entries. Use Undo to remove a wrong award.
        </p>
      </section>

      {[...groups.entries()].map(([day, dayItems]) => {
        const dayTotal = dayItems
          .filter((c) => c.status === "approved")
          .reduce((sum, c) => sum + c.points_snapshot, 0);
        return (
          <section className="card" key={day}>
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="font-bold text-slate-800">{day}</h3>
              <span className="text-sm font-semibold text-brand-700 tabular-nums">
                +{dayTotal}
              </span>
            </div>
            <ul className="divide-y divide-slate-100">
              {dayItems.map((c) => {
                const pending = c.status === "pending";
                const icon = pending ? "⏳ " : c.is_bonus ? "⭐ " : "✅ ";
                return (
                  <li
                    key={c.id}
                    className={`flex items-center justify-between gap-3 py-2 ${
                      pending ? "bg-amber-50/60 -mx-2 px-2 rounded-lg" : ""
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="font-medium">
                        {icon}
                        {c.task_name_snapshot}
                      </span>
                      {c.note && (
                        <span className="block text-xs text-slate-500">
                          {c.note}
                        </span>
                      )}
                      {pending && (
                        <span className="block text-xs text-amber-700 font-medium">
                          Waiting for approval
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-3">
                      <span
                        className={`font-semibold tabular-nums ${
                          pending ? "text-amber-700" : "text-brand-700"
                        }`}
                      >
                        +{c.points_snapshot}
                      </span>
                      {pending ? (
                        <>
                          <form action={approveCompletionAction}>
                            <input type="hidden" name="id" value={c.id} />
                            <button
                              type="submit"
                              className="text-xs font-semibold text-emerald-700 hover:underline"
                            >
                              Approve
                            </button>
                          </form>
                          <form action={denyCompletionAction}>
                            <input type="hidden" name="id" value={c.id} />
                            <button
                              type="submit"
                              className="text-xs text-rose-600 hover:underline"
                            >
                              Deny
                            </button>
                          </form>
                        </>
                      ) : (
                        <form action={deleteCompletionAction}>
                          <input type="hidden" name="id" value={c.id} />
                          <button
                            type="submit"
                            className="text-xs text-rose-600 hover:underline"
                          >
                            Undo
                          </button>
                        </form>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {items.length === 0 && (
        <p className="text-center text-sm text-slate-500 italic">
          No activity yet.
        </p>
      )}
    </div>
  );
}
