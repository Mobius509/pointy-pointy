/* eslint-disable @next/next/no-img-element */
import type { KidProfile, V2Completion } from "@/lib/v2/data";
import { avatarSrc } from "@/lib/avatar";
import {
  approveCompletionAction,
  denyCompletionAction,
} from "../_actions/approvals";

export function PendingApprovals({
  slug,
  items,
  kids,
}: {
  slug: string;
  items: V2Completion[];
  kids: KidProfile[];
}) {
  const kidById = new Map(kids.map((k) => [k.id, k]));

  if (items.length === 0) {
    return (
      <section className="card">
        <h3 className="text-lg font-bold text-slate-800">Pending approvals</h3>
        <p className="text-sm text-slate-500 italic mt-1">
          No tasks waiting. When a kid taps a task, it&apos;ll appear here for
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
        {items.map((c) => {
          const isKidProposal = c.task_id === null && c.is_bonus;
          const kid = c.kid_profile_id ? kidById.get(c.kid_profile_id) : null;
          return (
            <li
              key={c.id}
              className="rounded-xl bg-white ring-1 ring-amber-200 p-3 flex flex-col gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex-1 min-w-0">
                  <span className="font-semibold block truncate">
                    {isKidProposal ? "💡" : "⏳"} {c.task_name_snapshot}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    {kid && (
                      <>
                        <img
                          src={avatarSrc(kid.avatar_emoji)}
                          alt=""
                          aria-hidden
                          className="w-4 h-4 object-contain"
                        />
                        <span>{kid.name} ·</span>
                      </>
                    )}
                    <span>
                      {isKidProposal ? "Suggested" : "Submitted"}{" "}
                      {new Date(c.completed_at).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                </span>
                {!isKidProposal && (
                  <span className="flex-shrink-0 rounded-full bg-brand-100 text-brand-700 px-3 py-1 text-sm font-bold tabular-nums">
                    +{c.points_snapshot}
                  </span>
                )}
              </div>

              <form
                action={approveCompletionAction}
                className="flex flex-wrap items-center gap-2"
              >
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="id" value={c.id} />
                {isKidProposal && (
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    Points
                    <input
                      name="points"
                      type="number"
                      min={0}
                      max={1000}
                      defaultValue={5}
                      required
                      className="input w-20 text-center"
                    />
                  </label>
                )}
                <button
                  type="submit"
                  className="btn-primary flex-1 sm:flex-none"
                >
                  Approve
                </button>
              </form>
              <form action={denyCompletionAction}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="id" value={c.id} />
                <button type="submit" className="btn-secondary w-full">
                  Deny
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
