/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { avatarSrc } from "@/lib/avatar";
import { arcadeGameIcon } from "@/lib/games";
import type { KidHome } from "@/lib/v2/kid-home";
import { CelebrateCard } from "./CelebrateCard";
import { GoalModule } from "./GoalModule";
import { Ring } from "./KidRing";

// The kid app's home (Stats): greeting with their avatar, "let's
// celebrate" when approvals are waiting, this week's streak, the goal ring
// and their arcade tickets. Mirrors the iOS app's StatsView. `preview`: a
// parent's "Kid view".
export function KidStats({ slug, home, preview = false }: { slug: string; home: KidHome; preview?: boolean }) {
  const { view, streaks, greeting, pendingCelebration } = home;
  return (
    <div className="space-y-2.5">
      {/* Greeting, with the avatar standing on the card's top edge. */}
      <section className="relative mt-[42px] rounded-[36px] bg-white px-6 pb-6 pt-[89px]">
        <img
          src={avatarSrc(view.kid.avatar_emoji)}
          alt=""
          aria-hidden
          className="absolute -left-[13px] -top-[99px] size-[190px] object-contain"
        />
        <h1 className="max-w-[240px] text-[27px] font-medium leading-[1.1] tracking-[-0.01em] text-kid-text">
          {greeting}
        </h1>
      </section>

      {pendingCelebration.length > 0 && <CelebrateCard slug={slug} disabled={preview} />}

      {streaks[0] && <StreakWeekCard slug={slug} home={home} preview={preview} />}

      <GoalRingCard home={home} />

      <div className="pt-3">
        <TicketCard slug={slug} home={home} preview={preview} />
      </div>
    </div>
  );
}

// "This week's streak": a pill per day — ✓ done, ✗ missed, grey for a rest
// day — and how many tasks are left today.
function StreakWeekCard({ slug, home, preview }: { slug: string; home: KidHome; preview: boolean }) {
  const streak = home.streaks[0];
  const left = home.view.items.filter((i) => i.state === "open").length;
  const label =
    home.view.items.length === 0
      ? "No tasks today"
      : left === 0
        ? "All done today! 🎉"
        : `${left} Task${left === 1 ? "" : "s"} To Do Today`;
  const button = "block w-full rounded-full bg-kid-strong py-3 text-center text-[16px] font-medium text-white";
  return (
    <section className="rounded-[36px] bg-white px-6 pb-6 pt-7">
      <h2 className="text-[18px] font-medium leading-6 text-kid-text">This week&apos;s streak</h2>
      <ol className="mb-2.5 mt-[18px] flex justify-between gap-2" aria-label={`${streak.streak.name}: this week`}>
        {streak.week.map((d) => (
          <li
            key={d.day}
            title={`${weekday(d.day)}: ${d.state}`}
            className={`relative flex h-[70px] flex-1 flex-col items-center rounded-full ${
              d.state === "rest" ? "justify-center bg-[#F1F1F1] text-[#BDBDBD]" : "justify-end bg-kid-track pb-2.5 text-kid-text"
            } ${d.state === "today" ? "ring-2 ring-inset ring-kid-strong/50" : ""}`}
          >
            {d.state === "done" && <DoneIcon className="absolute top-1 size-5 text-kid-strong" />}
            {d.state === "missed" && <img src="/icons/Icon_Nope.svg" alt="" className="absolute top-1 size-5" />}
            <span aria-hidden className="text-[18px] font-medium leading-none">
              {weekday(d.day).slice(0, 1).toLowerCase()}
            </span>
            <span className="sr-only">
              {weekday(d.day)}: {d.state === "rest" ? "rest day" : d.state}
            </span>
          </li>
        ))}
      </ol>
      {preview ? (
        <span className={button}>{label}</span>
      ) : (
        <Link href={`/h/${slug}/tasks`} className={`${button} transition active:scale-[0.99]`}>
          {label}
        </Link>
      )}
    </section>
  );
}

// The exported checkmark (a ✓ cut out of a circle), in the current color.
function DoneIcon({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`kid-icon inline-block ${className ?? ""}`}
      style={{ "--icon": "url(/icons/Icon_Checkmark.svg)" } as React.CSSProperties}
    />
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
  const goalCard = goal && {
    pct: goalPct,
    caption: `Towards ${goal.name}`,
    points: progress,
    label: goal.name,
    emoji: goal.emoji ?? null,
  };
  // The ring: progress to the next milestone (or to the goal once they're
  // all reached).
  const ring = next
    ? {
        pct: pct((progress - prev) / Math.max(1, next.points - prev)),
        label: next.name,
        caption: "Towards your next milestone",
        points: progress,
        emoji: next.emoji,
      }
    : (goalCard ?? { pct: 0, label: "points", caption: "", points: progress, emoji: null });

  // Both a next milestone and a goal: the two cards that hand over as the
  // kid scrolls (or taps).
  if (goalCard && next) return <GoalModule milestone={ring} goal={goalCard} />;

  return (
    <section className="rounded-[36px] bg-kid-panel p-6">
      <div className="rounded-[28px] bg-white pt-[46px]">
        <div className="mx-auto w-[262px]">
          <Ring pct={ring.pct} points={progress} label={ring.label} emoji={ring.emoji} />
        </div>
        {ring.caption ? (
          <div className="flex h-[85px] items-center justify-between gap-4 px-[19px]">
            <span className="text-[37px] font-medium leading-none text-kid-text-strong">{ring.pct}%</span>
            <span className="text-right text-[14px] font-medium text-kid-text-strong">{ring.caption}</span>
          </div>
        ) : (
          <div className="h-[46px]" />
        )}
      </div>
    </section>
  );
}

// "Arcade Tickets": how many they have, and what the arcade is up to —
// closed (no tickets), locked (no streak going), open, or the game they're
// in the middle of. Tapping it opens the Arcade tab.
function TicketCard({ slug, home, preview }: { slug: string; home: KidHome; preview: boolean }) {
  const { tickets, mode, playing } = home.arcade;
  const label = playing
    ? home.ticketGame.name
    : tickets === 0
      ? "Closed"
      : mode === "locked"
        ? "Locked 🔒"
        : mode === "pick"
          ? "Open · you pick!"
          : "Open";
  const status = (
    <>
      {home.ticketGame.art ? (
        <img src={home.ticketGame.art} alt="" className="-my-2 h-[34px] w-auto" />
      ) : (
        <span aria-hidden>{arcadeGameIcon(home.ticketGame.game)}</span>
      )}
      <span className="truncate">{label}</span>
    </>
  );
  const inner = (
    <>
      <h2 className="text-[18px] font-medium leading-6 text-kid-text">Arcade Tickets</h2>
      <hr className="mt-4 border-kid-strong/60" />
      <p className="flex h-[117px] items-center text-[68px] font-medium leading-none text-kid-text-strong tabular-nums">
        {tickets}
      </p>
      <hr className="border-kid-strong/60" />
      <div className="flex h-[63px] items-center justify-between gap-3">
        <span className="whitespace-nowrap text-[18px] font-medium text-kid-text">Arcade is currently</span>
        <span className="flex h-[37px] min-w-[141px] max-w-[60%] items-center justify-center gap-1.5 rounded-full bg-white px-4 text-[15px] font-medium text-kid-text">
          {status}
        </span>
      </div>
    </>
  );
  const cls = "kid-ticket block aspect-[370/282.4] w-full bg-kid-panel px-6 pt-[38px]";
  return preview ? (
    <section className={cls}>{inner}</section>
  ) : (
    <Link href={`/h/${slug}/arcade`} className={`${cls} transition active:scale-[0.99]`}>
      {inner}
    </Link>
  );
}

const weekday = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
