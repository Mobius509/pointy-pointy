/* eslint-disable @next/next/no-img-element */
import { avatarSrc } from "@/lib/avatar";
import type { KidTodayView } from "@/lib/v2/kid-ops";
import type { HighScore } from "@/app/_components/CelebrationScreen";
import type { Arcade as ArcadeState, KidStreak } from "@/lib/v2/streaks";
import { Arcade } from "./Arcade";
import { CelebrationOverlay } from "./CelebrationOverlay";
import { GoalMilestones } from "./GoalMilestones";
import { KidStreaks } from "./KidStreaks";
import { RainToggle } from "./RainToggle";
import { RefreshOnFocus } from "./RefreshOnFocus";
import { V2DailyChecklist } from "./V2DailyChecklist";
import { V2KidProposal } from "./V2KidProposal";

// The signed-in kid's home: avatar + name, streaks, goal, checklist,
// arcade. Shared by the kid page and the parent "Kid view" preview
// (`preview`: look, don't touch — nothing the kid would act on works).
export function KidHome({
  slug,
  view,
  streaks,
  arcade,
  highScores,
  preview = false,
}: {
  slug: string;
  view: KidTodayView;
  streaks: KidStreak[];
  arcade: ArcadeState;
  highScores: Record<string, HighScore>;
  preview?: boolean;
}) {
  const { kid, goal, progress, milestones, items, pendingProposals, recentApprovals } = view;
  // First name only on every screen — last name (= family name) takes up
  // too much room in the centered header and isn't needed by the kid.
  const displayName = kid.name;
  const remaining = goal
    ? Math.max(0, goal.target_points - progress)
    : 0;
  const goalPct = goal
    ? Math.min(100, Math.round((progress / Math.max(1, goal.target_points)) * 100))
    : 0;

  return (
    <>
      {/* Outer translucent panel — same shell treatment as the parent admin.
          Avatar centered above (half above / half inside), kid name
          centered directly underneath. Current points is shown inside
          the progress-bar fill, so we don't need a separate big counter. */}
      <div className="relative bg-white/60 backdrop-blur-md rounded-[32px] px-3 sm:px-8 pt-0 pb-3 sm:pb-8 mt-24 sm:mt-28">
        <div className="flex flex-col items-center">
          <img
            src={avatarSrc(kid.avatar_emoji)}
            alt=""
            aria-hidden
            className="block w-40 h-40 -mt-20 object-contain"
          />
          <h1
            className="mt-1 text-pp-primary leading-tight text-center"
            style={{ fontSize: 26, fontWeight: 700 }}
          >
            {displayName}
          </h1>
        </div>

        <div className="mt-6 space-y-6">
          {/* Streaks up top — what to keep going today. */}
          <KidStreaks streaks={streaks} items={items} />

          {/* Progress card */}
        {goal && (
          <section className="bg-white rounded-[32px] px-4 sm:px-6 py-6 shadow-sm">
            {/* Mobile: icon+name, then the bar. Desktop: one row with the
                target on the right. Milestones sit in an accordion below. */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
              {/* Icon + goal name. */}
              <div className="flex items-center gap-3 sm:gap-5 min-w-0">
                <span className="text-3xl sm:text-4xl flex-shrink-0" aria-hidden>
                  🐶
                </span>
                <span
                  className="flex-shrink-0 text-pp-primary-strong"
                  style={{ fontSize: 16, fontWeight: 500 }}
                >
                  {goal.name}
                </span>
              </div>

              {/* Bar with milestone dots, then the % / points-to-go line. */}
              <div className="flex-1 sm:min-w-[160px]">
                <div className="rounded-full bg-pp-line px-1 flex items-center h-8">
                  <div className="relative h-6 w-full">
                    <div
                      className="absolute inset-y-0 left-0 bg-brand-gradient rounded-full flex items-center justify-center text-white tabular-nums font-semibold transition-[width] duration-500 ease-out"
                      style={{
                        width: `max(${goalPct}%, 3rem)`,
                        fontSize: 12,
                      }}
                    >
                      {progress.toLocaleString()}
                    </div>
                    {milestones.map((m) => {
                      const left = Math.min(
                        100,
                        (m.points / goal.target_points) * 100,
                      );
                      const unlocked = progress >= m.points;
                      return (
                        <span
                          key={m.id}
                          aria-hidden
                          title={`${m.name} · ${m.points.toLocaleString()} pts`}
                          className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ${
                            unlocked
                              ? "size-2.5 bg-white ring-2 ring-pp-primary"
                              : "size-1.5 bg-pp-primary/40"
                          }`}
                          style={{ left: `${left}%`, top: "50%" }}
                        />
                      );
                    })}
                  </div>
                </div>
                <div
                  className="flex items-center justify-between mt-2 text-pp-primary tabular-nums"
                  style={{ fontSize: 12, fontWeight: 600 }}
                >
                  <span>{goalPct}% There</span>
                  <span>{remaining.toLocaleString()} points to go</span>
                </div>
              </div>

              {/* Target — desktop only. On mobile the "points to go"
                  line already conveys the gap. */}
              <span
                className="hidden sm:inline flex-shrink-0 self-start mt-1 text-pp-primary tabular-nums"
                style={{ fontSize: 16, fontWeight: 500 }}
              >
                {goal.target_points.toLocaleString()}
              </span>
            </div>

            <GoalMilestones milestones={milestones} progress={progress} />
          </section>
        )}

        {/* Tasks list */}
        <section className="bg-white rounded-[32px] p-4 sm:p-6 shadow-sm">
          <V2DailyChecklist slug={slug} items={items} readOnly={preview} />
        </section>

          {/* Did something extra? */}
          <V2KidProposal slug={slug} pendingProposals={pendingProposals} readOnly={preview} />

          {/* The games streaks unlock. */}
          {(streaks.length > 0 || arcade.unlocked.length > 0 || arcade.tickets.length > 0) && (
            <Arcade
              slug={slug}
              avatarSrc={avatarSrc(kid.avatar_emoji)}
              arcade={arcade}
              highScores={highScores}
              preview={preview}
              kidName={kid.name}
            />
          )}

          {/* Celebrate approvals this device hasn't celebrated yet (not in a
              parent's preview — that would use up the kid's celebrations). */}
          {!preview && (
          <CelebrationOverlay
            slug={slug}
            kidId={kid.id}
            avatarSrc={avatarSrc(kid.avatar_emoji)}
            approvals={recentApprovals}
            progress={progress}
            milestones={milestones.map((m) => ({ name: m.name, points: m.points }))}
            goal={goal ? { name: goal.name, targetPoints: goal.target_points } : null}
            highScores={highScores}
          />
          )}
          <RefreshOnFocus />

          {/* Fun: falling emojis you can throw around. */}
          <RainToggle avatarSrc={avatarSrc(kid.avatar_emoji)} />
        </div>
      </div>
    </>
  );
}
