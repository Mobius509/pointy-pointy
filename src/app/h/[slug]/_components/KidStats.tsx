/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { avatarSrc } from "@/lib/avatar";
import type { KidHome } from "@/lib/v2/kid-home";
import { CelebrateCard } from "./CelebrateCard";
import { GoalModule } from "./GoalModule";
import { Ring } from "./KidRing";

// The kid app's home (Stats): greeting with their avatar, "let's
// celebrate" when approvals are waiting, this week's streak, and the goal
// ring. Mirrors the iOS app's StatsView. `preview`: a parent's "Kid view".
export function KidStats({ slug, home, preview = false }: { slug: string; home: KidHome; preview?: boolean }) {
  const { view, streaks, greeting, pendingCelebration } = home;
  return (
    <div className="space-y-2.5">
      {/* Greeting, with the avatar standing on the card's top edge. */}
      <section className="relative mt-[88px] rounded-[32px] bg-kid-card px-7 pb-7 pt-[72px]">
        <img
          src={avatarSrc(view.kid.avatar_emoji)}
          alt=""
          aria-hidden
          className="absolute -top-[96px] left-5 size-[150px] object-contain"
        />
        <h1 className="text-[33px] font-medium leading-[1.06] tracking-[-0.01em] text-kid-strong">{greeting}</h1>
      </section>

      {pendingCelebration.length > 0 && <CelebrateCard slug={slug} disabled={preview} />}

      {streaks[0] && <StreakWeekCard slug={slug} home={home} preview={preview} />}

      <GoalRingCard home={home} />
    </div>
  );
}

// "This week's streak": a dot per day of this week (weekdays only for a
// streak that skips weekends), filled when that day's streak was done.
function StreakWeekCard({ slug, home, preview }: { slug: string; home: KidHome; preview: boolean }) {
  const streak = home.streaks[0];
  const left = home.view.items.filter((i) => i.state === "open").length;
  const label =
    home.view.items.length === 0
      ? "No tasks today"
      : left === 0
        ? "All done today! 🎉"
        : `${left} Task${left === 1 ? "" : "s"} To Do Today`;
  const pill = "block w-full rounded-full bg-white py-2.5 text-center text-[15px] font-medium text-kid-text";
  return (
    <section className="rounded-[32px] bg-kid-card px-7 pb-5 pt-5">
      <h2 className="text-[17px] font-medium text-kid-strong">This week&apos;s streak</h2>
      <ol className="my-4 flex justify-center gap-4" aria-label={`${streak.streak.name}: this week`}>
        {streak.week.map((d) => (
          <li
            key={d.day}
            title={`${weekday(d.day)}: ${d.state}`}
            className={`size-10 rounded-full ${
              d.state === "done"
                ? "bg-kid-text ring-[3px] ring-inset ring-white"
                : d.state === "today"
                  ? "bg-white ring-2 ring-inset ring-kid-strong"
                  : d.state === "missed"
                    ? "bg-white/50"
                    : "bg-white"
            }`}
          >
            <span className="sr-only">
              {weekday(d.day)}: {d.state}
            </span>
          </li>
        ))}
      </ol>
      {preview ? (
        <span className={pill}>{label}</span>
      ) : (
        <Link href={`/h/${slug}/tasks`} className={`${pill} transition active:scale-[0.99]`}>
          {label}
        </Link>
      )}
    </section>
  );
}

// The goal ring: their points, filling toward the next milestone; then how
// far toward the goal itself.
function GoalRingCard({ home }: { home: KidHome }) {
  const { goal, progress, milestones } = home.view;
  const next = milestones.find((m) => m.points > progress);
  const prev = [...milestones].reverse().find((m) => m.points <= progress)?.points ?? 0;
  const pct = (n: number) => Math.max(0, Math.min(100, Math.round(n * 100)));
  const goalPct = goal ? pct(progress / Math.max(1, goal.target_points)) : 0;
  // The ring: progress to the next milestone (or to the goal once they're
  // all reached).
  const ring = next
    ? { pct: pct((progress - prev) / Math.max(1, next.points - prev)), label: next.name, caption: "Towards your next milestone" }
    : goal
      ? { pct: goalPct, label: goal.name, caption: `Towards ${goal.name}` }
      : { pct: 0, label: "points", caption: "" };

  // Both a next milestone and a goal: the two cards that hand over as the
  // kid scrolls (or taps).
  if (goal && next)
    return (
      <GoalModule
        milestone={{ ...ring, points: progress }}
        goal={{ pct: goalPct, caption: `Towards ${goal.name}`, points: progress, label: goal.name }}
      />
    );

  return (
    <section className="rounded-[36px] bg-kid-card p-[18px] space-y-[18px]">
      <div className="rounded-[28px] bg-white px-5 pb-6 pt-7">
        <Ring pct={ring.pct} points={progress} label={ring.label} />
        {ring.caption && (
          <div className="mt-4 flex items-end justify-between gap-4">
            <span className="text-[34px] font-medium leading-none text-kid-text-strong">{ring.pct}%</span>
            <span className="pb-1 text-right text-[13px] font-medium text-kid-text-strong">{ring.caption}</span>
          </div>
        )}
      </div>
    </section>
  );
}

const weekday = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });

