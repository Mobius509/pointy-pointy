/* eslint-disable @next/next/no-img-element */
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
  pending: V2Completion[];
  taskById: Map<string, V2Task>;
  outstandingByFreq: Map<Frequency, V2Task[]>;
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

// Avatar PNG placeholder — when we ship the avatar picker, this maps the
// kid's chosen icon to its image. For now, all kids show the dog illustration.
function avatarSrc(emoji: string): string {
  switch (emoji) {
    case "🐶":
      return "/emojis/dog1.png";
    case "🐱":
      return "/emojis/cat1.png";
    case "🦄":
      return "/emojis/unicorn.png";
    case "🐯":
      return "/emojis/cat2.png";
    case "🐸":
    case "🦖":
      return "/emojis/gecko.png";
    default:
      return "/emojis/dog1.png";
  }
}

export function KidOverviewCard({
  slug,
  kid,
  pending,
  taskById,
  outstandingByFreq,
  goal,
  progress,
}: Props) {
  const goalPct = goal
    ? Math.min(
        100,
        Math.round((progress / Math.max(1, goal.target_points)) * 100),
      )
    : 0;

  return (
    <section className="space-y-3">
      {/* Inner white card — rounded all 4 corners */}
      <div
        className="bg-white p-5 sm:p-8 shadow-sm"
        style={{ borderRadius: 32 }}
      >
        <div className="grid gap-6 md:grid-cols-[210px_1fr]">
          {/* Left: avatar in a peach card + name + Award Bonus button below */}
          <div className="flex flex-col gap-3">
            <div
              className="bg-[#F1D1BD]/70 px-4 pt-6 pb-5 text-center"
              style={{ borderRadius: 28 }}
            >
              <img
                src={avatarSrc(kid.avatar_emoji)}
                alt=""
                aria-hidden
                className="mx-auto w-32 h-32 object-contain"
              />
              <h3 className="mt-3 text-2xl font-semibold text-[#D45B00]">
                {kid.name}
              </h3>
            </div>
            <div className="flex justify-center">
              <BonusForKidButton slug={slug} kid={kid} />
            </div>
          </div>

          {/* Right: To Approve + Outstanding */}
          <div className="space-y-6">
            {/* To Approve */}
            <div>
              <SectionPill>To Approve</SectionPill>
              {pending.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500 italic">
                  Nothing waiting on you.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100">
                  {pending.map((c) => {
                    const isProposal = c.task_id === null && c.is_bonus;
                    return (
                      <li
                        key={c.id}
                        className="py-3 flex flex-wrap items-center gap-3"
                      >
                        <span className="flex-1 min-w-0 text-base font-medium text-slate-800 truncate">
                          {c.task_name_snapshot}
                          {isProposal && (
                            <span className="ml-2 text-xs text-amber-700">
                              · suggested
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <form action={denyCompletionAction}>
                            <input type="hidden" name="slug" value={slug} />
                            <input type="hidden" name="id" value={c.id} />
                            <button
                              type="submit"
                              className="rounded-full bg-white border border-[#F1D1BD] text-[#D45B00] font-semibold px-6 py-2 text-sm transition hover:bg-[#FFF7EE] active:scale-[0.99]"
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
                                className="w-16 rounded-full border-[#F1D1BD] bg-white px-2 py-1.5 text-sm text-center ring-1 ring-[#F1D1BD] focus:outline-none focus:ring-2 focus:ring-[#D45B00]"
                              />
                            )}
                            <button
                              type="submit"
                              className="rounded-full bg-[#FBE3CF] text-[#D45B00] font-semibold px-6 py-2 text-sm transition hover:bg-[#F7D2B3] active:scale-[0.99]"
                            >
                              Approve
                            </button>
                          </form>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Outstanding (active tasks not yet acted on this period) */}
            <div>
              <SectionPill>Outstanding</SectionPill>
              {outstandingByFreq.size === 0 ? (
                <p className="mt-3 text-sm text-slate-500 italic">
                  All caught up — nothing outstanding.
                </p>
              ) : (
                <div className="mt-3 divide-y divide-slate-100">
                  {FREQUENCY_ORDER.filter((f) =>
                    outstandingByFreq.has(f),
                  ).map((freq) => {
                    const list = outstandingByFreq.get(freq)!;
                    return (
                      <details
                        key={freq}
                        className="group py-3"
                      >
                        <summary className="flex items-center justify-between cursor-pointer list-none text-base font-medium text-slate-800">
                          <span>
                            {list.length}{" "}
                            {frequencyLabel(freq)}{" "}
                            {list.length === 1 ? "Task" : "Tasks"}
                          </span>
                          <span
                            aria-hidden
                            className="text-slate-400 transition-transform group-open:rotate-180"
                          >
                            ▾
                          </span>
                        </summary>
                        <ul className="mt-2 ml-1 space-y-1 text-sm text-slate-600">
                          {list.map((t) => (
                            <li key={t.id} className="flex items-center gap-2">
                              <span aria-hidden>○</span>
                              <span className="flex-1">{t.name}</span>
                              <span className="text-xs font-semibold text-[#D45B00] tabular-nums">
                                +{t.points}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Inset peach points bar — sits below the white card with 16px indent
          on each side. Contains the kid's current points and the goal
          progress bar. */}
      <div
        className="mx-4 px-5 sm:px-7 py-5 flex flex-wrap items-center gap-6 bg-[#F1D1BD]"
        style={{ borderRadius: 24 }}
      >
        <div className="flex-shrink-0">
          <div className="text-5xl sm:text-6xl font-extrabold text-[#D45B00] leading-none tabular-nums">
            {progress.toLocaleString()}
          </div>
          <div className="mt-1 text-sm font-semibold text-[#D45B00]">
            Current Points
          </div>
        </div>
        {goal && (
          <div className="flex-1 min-w-[200px] flex items-center gap-3">
            <span className="text-sm font-semibold text-[#6B5805] truncate">
              {goal.name}
            </span>
            <div className="flex-1 h-3 rounded-full bg-white/60 overflow-hidden">
              <div
                className="h-full bg-[#D45B00] rounded-full transition-[width] duration-500 ease-out"
                style={{ width: `${goalPct}%` }}
              />
            </div>
          </div>
        )}
      </div>
      {/* taskById is unused here right now but kept in the prop type for
          future use (e.g. surfacing per-task description in the pending list). */}
      {void taskById}
    </section>
  );
}

function SectionPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-full bg-[#FBE3CF] text-[#D45B00] px-4 py-1 text-sm font-semibold">
      {children}
    </span>
  );
}
