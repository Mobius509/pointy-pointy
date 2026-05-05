import { requireHouseholdAccess } from "@/lib/v2/auth";
import { getHouseholdRecentCompletions, getKidProfiles } from "@/lib/v2/data";
import {
  approveCompletionAction,
  deleteCompletionAction,
  denyCompletionAction,
} from "../_actions/approvals";

export const dynamic = "force-dynamic";

export default async function ParentActivityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const household = await requireHouseholdAccess(slug);
  const items = await getHouseholdRecentCompletions(household.id, 200);
  const kids = await getKidProfiles(household.id);
  const kidById = new Map(kids.map((k) => [k.id, k]));

  // Group by date.
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
          Up to last 200 entries across all kids. Use Undo to remove a wrong
          award.
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
                const kid = c.kid_profile_id
                  ? kidById.get(c.kid_profile_id)
                  : undefined;
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
                      {kid && (
                        <span className="ml-2 text-xs text-slate-500">
                          {kid.avatar_emoji} {kid.name}
                        </span>
                      )}
                      {c.note && (
                        <span className="block text-xs text-slate-500">
                          {c.note}
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
                            <input type="hidden" name="slug" value={slug} />
                            <input type="hidden" name="id" value={c.id} />
                            <button
                              type="submit"
                              className="text-xs font-semibold text-emerald-700 hover:underline"
                            >
                              Approve
                            </button>
                          </form>
                          <form action={denyCompletionAction}>
                            <input type="hidden" name="slug" value={slug} />
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
                          <input type="hidden" name="slug" value={slug} />
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
