/* eslint-disable @next/next/no-img-element */
import type { KidProfile, V2Completion, V2Goal, V2Task } from "@/lib/v2/data";
import { frequencyLabel, humanizeDate, type Frequency } from "@/lib/time";
import {
  approveCompletionAction,
  denyCompletionAction,
} from "../_actions/approvals";
import { ApprovedRowMenu } from "./ApprovedRowMenu";
import { BonusForKidButton } from "./BonusForKidButton";

type Props = {
  slug: string;
  kid: KidProfile;
  pending: V2Completion[];
  taskById: Map<string, V2Task>;
  outstandingByFreq: Map<Frequency, V2Task[]>;
  recentApproved: V2Completion[];
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

// Evenly-spaced milestone markers at 20/40/60/80% of the goal, snapped to
// a round step so the labels read cleanly (e.g. 1000 / 2000 / 3000 / 4000).
function buildMilestones(target: number): number[] {
  if (target <= 0) return [];
  return [0.2, 0.4, 0.6, 0.8].map((frac) => {
    const raw = target * frac;
    const step = target >= 1000 ? 100 : target >= 100 ? 10 : 1;
    return Math.round(raw / step) * step;
  });
}

export function KidOverviewCard({
  slug,
  kid,
  pending,
  taskById,
  outstandingByFreq,
  recentApproved,
  goal,
  progress,
}: Props) {
  const goalPct = goal
    ? Math.min(
        100,
        Math.round((progress / Math.max(1, goal.target_points)) * 100),
      )
    : 0;
  const milestones = goal ? buildMilestones(goal.target_points) : [];

  return (
    <section className="space-y-3">
      {/* White card — fully rounded on all 4 corners. */}
      <div className="bg-white rounded-[32px] p-5 sm:p-8 shadow-sm">
        <div className="grid gap-6 md:grid-cols-[130px_1fr] text-[14px]">
          {/* Left column: avatar card → points card (with Award Bonus
              button straddling the bottom edge). */}
          <div className="space-y-6">
            {/* Avatar + name */}
            <div className="bg-[#F9EBE3] rounded-[22px] w-[130px] px-3 pt-5 pb-4 text-center">
              <img
                src={avatarSrc(kid.avatar_emoji)}
                alt=""
                aria-hidden
                className="mx-auto w-24 h-24 object-contain"
              />
              <h3
                className="mt-2 text-[#D45B00]"
                style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.1 }}
              >
                {kid.name}
              </h3>
            </div>

            {/* Points + 'Current Points' caption. Award Bonus button is
                absolutely positioned at the bottom so it visually straddles
                the edge of the card. */}
            <div className="relative bg-[#F9EBE3] rounded-[22px] w-[130px] px-3 pt-5 pb-7 text-center mb-5">
              <div
                className="text-[#D45B00] tabular-nums leading-none"
                style={{ fontSize: 40, fontWeight: 500 }}
              >
                {progress.toLocaleString()}
              </div>
              <div
                className="mt-2 text-[#C3A38A]"
                style={{ fontSize: 12, fontWeight: 500 }}
              >
                Current Points
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2">
                <BonusForKidButton slug={slug} kid={kid} />
              </div>
            </div>
          </div>

          {/* Right column: To Approve + Outstanding (14px throughout via
              the parent grid). */}
          <div className="space-y-6">
            {/* To Approve */}
            <div>
              <SectionPill>To Approve</SectionPill>
              {pending.length === 0 ? (
                <p className="mt-3 text-slate-500 italic">
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
                        <span className="flex-1 min-w-0 font-medium text-slate-800 truncate">
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
                              className="rounded-full bg-white border border-[#F1D1BD] text-[#D45B00] font-semibold px-5 py-1.5 transition hover:bg-[#FFF7EE] active:scale-[0.99]"
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
                                className="w-14 rounded-full border-[#F1D1BD] bg-white px-2 py-1 text-center ring-1 ring-[#F1D1BD] focus:outline-none focus:ring-2 focus:ring-[#D45B00]"
                              />
                            )}
                            <button
                              type="submit"
                              className="rounded-full bg-[#FBE3CF] text-[#D45B00] font-semibold px-5 py-1.5 transition hover:bg-[#F7D2B3] active:scale-[0.99]"
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

            {/* Outstanding */}
            <div>
              <SectionPill>Outstanding</SectionPill>
              {outstandingByFreq.size === 0 ? (
                <p className="mt-3 text-slate-500 italic">
                  All caught up — nothing outstanding.
                </p>
              ) : (
                <div className="mt-3 divide-y divide-slate-100">
                  {FREQUENCY_ORDER.filter((f) =>
                    outstandingByFreq.has(f),
                  ).map((freq) => {
                    const list = outstandingByFreq.get(freq)!;
                    return (
                      <details key={freq} className="group py-3">
                        <summary className="flex items-center justify-between cursor-pointer list-none font-medium text-slate-800">
                          <span>
                            {list.length} {frequencyLabel(freq)}{" "}
                            {list.length === 1 ? "Task" : "Tasks"}
                          </span>
                          <span
                            aria-hidden
                            className="text-slate-400 transition-transform group-open:rotate-180"
                          >
                            ▾
                          </span>
                        </summary>
                        <ul className="mt-2 ml-1 space-y-1 text-slate-600">
                          {list.map((t) => (
                            <li key={t.id} className="flex items-center gap-2">
                              <span aria-hidden>○</span>
                              <span className="flex-1">{t.name}</span>
                              <span className="font-semibold text-[#D45B00] tabular-nums">
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

      {/* Goal strip — inset from the white card edges (mx-4), separate
          rounded panel with #F0DCCF bg. */}
      {goal && (
        <div className="mx-4 bg-[#F0DCCF] rounded-[24px] px-6 sm:px-8 py-4 sm:py-5">
          <div className="flex items-center gap-3 sm:gap-5">
            <span className="text-3xl sm:text-4xl flex-shrink-0" aria-hidden>
              🐶
            </span>
            <span
              className="flex-shrink-0 text-[#733405]"
              style={{ fontSize: 16, fontWeight: 500 }}
            >
              {goal.name}
            </span>

            {/* Bar with milestone labels absolutely positioned just above */}
            <div className="relative flex-1 min-w-[120px]">
              <div
                className="absolute inset-x-0 pointer-events-none h-4"
                style={{ bottom: "calc(100% + 2px)" }}
              >
                {milestones.map((m) => {
                  const left = Math.min(
                    100,
                    Math.max(0, (m / goal.target_points) * 100),
                  );
                  return (
                    <span
                      key={m}
                      className="absolute -translate-x-1/2 text-[#D45B00] tabular-nums"
                      style={{
                        left: `${left}%`,
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      {m.toLocaleString()}
                    </span>
                  );
                })}
              </div>
              <div className="relative h-3 rounded-full bg-white/70">
                <div
                  className="absolute inset-y-0 left-0 bg-[#D45B00] rounded-full transition-[width] duration-500 ease-out"
                  style={{ width: `${goalPct}%` }}
                />
                {milestones.map((m) => {
                  const left = Math.min(
                    100,
                    (m / goal.target_points) * 100,
                  );
                  return (
                    <span
                      key={m}
                      aria-hidden
                      className="absolute size-1.5 rounded-full bg-[#D45B00] -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${left}%`, top: "50%" }}
                    />
                  );
                })}
              </div>
            </div>

            <span
              className="flex-shrink-0 text-[#733405] tabular-nums"
              style={{ fontSize: 16, fontWeight: 500 }}
            >
              {goal.target_points.toLocaleString()}
            </span>
          </div>
        </div>
      )}
      {/* Previously Approved — recent approved completions for this kid.
          Uses the same white-card-with-rounded-corners treatment as the
          main card above. */}
      {recentApproved.length > 0 && (
        <div className="bg-white rounded-[32px] p-5 sm:p-8 shadow-sm text-[14px]">
          <SectionPill>Previously Approved</SectionPill>
          <ul className="mt-3 divide-y divide-slate-100">
            {recentApproved.map((c) => (
              <li
                key={c.id}
                className="py-3 flex items-center gap-3"
              >
                <span className="flex-1 min-w-0">
                  <span className="block font-medium text-slate-800 truncate">
                    {c.is_bonus ? "⭐ " : "✅ "}
                    {c.task_name_snapshot}
                  </span>
                  <span className="block text-xs text-[#C3A38A]">
                    {humanizeDate(c.completed_at)}
                  </span>
                </span>
                <span className="font-semibold text-[#D45B00] tabular-nums">
                  +{c.points_snapshot}
                </span>
                <ApprovedRowMenu
                  slug={slug}
                  id={c.id}
                  label={c.task_name_snapshot}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* taskById reserved for future per-task callouts in the pending list. */}
      {void taskById}
    </section>
  );
}

function SectionPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-full bg-[#F9EBE3] text-[#D45B00] px-4 py-1 font-semibold">
      {children}
    </span>
  );
}
