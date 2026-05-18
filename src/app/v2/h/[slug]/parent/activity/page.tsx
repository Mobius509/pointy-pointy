import { requireHouseholdAccess } from "@/lib/v2/auth";
import { getHouseholdRecentCompletions, getKidProfiles } from "@/lib/v2/data";
import {
  approveCompletionAction,
  deleteCompletionAction,
  denyCompletionAction,
} from "../_actions/approvals";
import { PageTitle, SectionPill } from "../_components/ui";

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
    <div className="space-y-6 text-[14px]">
      <PageTitle>Activity</PageTitle>

      <section className="card-warm">
        <SectionPill>Activity log</SectionPill>
        <p className="text-[#C3A38A] mt-2">
          Up to last 200 entries across all kids. Use Undo to remove a wrong
          award.
        </p>

        {items.length === 0 ? (
          <p className="mt-4 text-slate-500 italic">No activity yet.</p>
        ) : (
          <div className="mt-4 space-y-5">
            {[...groups.entries()].map(([day, dayItems]) => {
              const dayTotal = dayItems
                .filter((c) => c.status === "approved")
                .reduce((sum, c) => sum + c.points_snapshot, 0);
              return (
                <div key={day}>
                  <div className="flex items-baseline justify-between mb-2">
                    <h3 className="font-semibold text-[#D45B00]">{day}</h3>
                    <span className="font-semibold text-[#D45B00] tabular-nums">
                      +{dayTotal}
                    </span>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {dayItems.map((c) => {
                      const pending = c.status === "pending";
                      const kid = c.kid_profile_id
                        ? kidById.get(c.kid_profile_id)
                        : undefined;
                      const icon = pending
                        ? "⏳ "
                        : c.is_bonus
                          ? "⭐ "
                          : "✅ ";
                      return (
                        <li
                          key={c.id}
                          className={`flex flex-wrap items-center justify-between gap-3 py-2 ${
                            pending
                              ? "bg-[#F9EBE3]/60 -mx-2 px-2 rounded-lg"
                              : ""
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="font-medium text-slate-800">
                              {icon}
                              {c.task_name_snapshot}
                            </span>
                            {kid && (
                              <span className="ml-2 text-xs text-[#C3A38A]">
                                {kid.avatar_emoji} {kid.name}
                              </span>
                            )}
                            {c.note && (
                              <span className="block text-xs text-[#C3A38A]">
                                {c.note}
                              </span>
                            )}
                          </span>
                          <span className="flex items-center gap-2">
                            <span
                              className={`font-semibold tabular-nums ${
                                pending ? "text-amber-700" : "text-[#D45B00]"
                              }`}
                            >
                              +{c.points_snapshot}
                            </span>
                            {pending ? (
                              <>
                                <form action={approveCompletionAction}>
                                  <input
                                    type="hidden"
                                    name="slug"
                                    value={slug}
                                  />
                                  <input type="hidden" name="id" value={c.id} />
                                  <button
                                    type="submit"
                                    className="rounded-full bg-[#FBE3CF] text-[#D45B00] font-semibold px-3 py-1 text-xs"
                                  >
                                    Approve
                                  </button>
                                </form>
                                <form action={denyCompletionAction}>
                                  <input
                                    type="hidden"
                                    name="slug"
                                    value={slug}
                                  />
                                  <input type="hidden" name="id" value={c.id} />
                                  <button
                                    type="submit"
                                    className="rounded-full bg-white border border-[#F1D1BD] text-[#D45B00] font-semibold px-3 py-1 text-xs"
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
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
