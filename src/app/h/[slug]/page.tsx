/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { getKidSession } from "@/lib/v2/auth";
import { getKidProfiles } from "@/lib/v2/data";
import { getKidTodayView } from "@/lib/v2/kid-ops";
import { getHighScores } from "@/lib/v2/high-scores";
import { getArcade, getKidStreaks } from "@/lib/v2/streaks";
import { Arcade } from "./_components/Arcade";
import { KidStreaks } from "./_components/KidStreaks";
import { avatarSrc } from "@/lib/avatar";
import { KidPicker } from "./_components/KidPicker";
import { V2DailyChecklist } from "./_components/V2DailyChecklist";
import { V2KidProposal } from "./_components/V2KidProposal";
import { GoalMilestones } from "./_components/GoalMilestones";
import { RainToggle } from "./_components/RainToggle";
import { CelebrationOverlay } from "./_components/CelebrationOverlay";
import { RefreshOnFocus } from "./_components/RefreshOnFocus";
import { kidSignOutAction } from "./_actions/kid-session";

export const dynamic = "force-dynamic";


export default async function KidViewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data: household, error } = await supabaseV2Admin
    .from("households")
    .select("id, name, slug, timezone")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!household) notFound();

  const session = await getKidSession();
  const sessionMatchesHousehold =
    session && session.householdId === household.id;

  // Signed in — load the kid + today's checklist. (A session for a kid
  // that's since been removed counts as signed out; signing in again
  // replaces the cookie — pages can't clear cookies themselves.)
  const view = sessionMatchesHousehold
    ? await getKidTodayView({
        householdId: household.id as string,
        kidProfileId: session.kidProfileId,
        timezone: household.timezone as string,
      })
    : null;

  // Not signed in — show kid picker + PIN.
  if (!view) {
    const kids = await getKidProfiles(household.id as string);
    return (
      <Shell slug={slug}>
        <div className="max-w-2xl mx-auto pt-6">
          {kids.length === 0 ? (
            <div className="bg-white rounded-[32px] p-6 text-center">
              <p className="text-pp-primary">
                A parent hasn&apos;t set up any kids yet. Ask them to log in
                and add you!
              </p>
            </div>
          ) : (
            <>
              {kids.length > 1 && (
                <h1 className="text-[32px] font-medium text-pp-primary text-center mb-4">
                  Who&apos;s here?
                </h1>
              )}
              <KidPicker slug={household.slug as string} kids={kids} />
            </>
          )}
        </div>
      </Shell>
    );
  }

  const { kid, goal, progress, milestones, items, pendingProposals, recentApprovals } =
    view;
  const kidCtx = {
    householdId: household.id as string,
    kidProfileId: view.kid.id,
    timezone: household.timezone as string,
  };
  const [highScores, streaks, arcade] = await Promise.all([
    getHighScores(household.id as string),
    getKidStreaks(kidCtx),
    getArcade(kidCtx),
  ]);

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
    <Shell slug={slug}>
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
          <V2DailyChecklist slug={slug} items={items} />
        </section>

          {/* Did something extra? */}
          <V2KidProposal slug={slug} pendingProposals={pendingProposals} />

          {/* Streaks, and the games they unlock. */}
          <KidStreaks streaks={streaks} items={items} />
          {(streaks.length > 0 || arcade.unlocked.length > 0 || arcade.tickets.length > 0) && (
            <Arcade slug={slug} avatarSrc={avatarSrc(kid.avatar_emoji)} arcade={arcade} highScores={highScores} />
          )}

          {/* Celebrate approvals this device hasn't celebrated yet. */}
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
          <RefreshOnFocus />

          {/* Fun: falling emojis you can throw around. */}
          <RainToggle avatarSrc={avatarSrc(kid.avatar_emoji)} />
        </div>
      </div>
    </Shell>
  );
}

function Shell({
  children,
  slug,
}: {
  children: React.ReactNode;
  slug: string;
}) {
  return (
    <div
      className="relative min-h-screen flex flex-col bg-page"
    >
      <header className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-6 sm:px-8 py-5">
        <Link href="/" aria-label="Pointy Points home" className="group">
          <img
            src="/logos/logo_badge.svg"
            alt="Pointy Points"
            width={28}
            height={42}
            className="w-7 h-[42px] group-hover:animate-wiggle"
          />
        </Link>
        <span aria-hidden />
        <div className="justify-self-end flex items-center gap-5 text-sm">
          <Link
            href={`/h/${slug}/settings`}
            className="inline-flex items-center gap-1.5 font-semibold text-pp-primary hover:opacity-80"
          >
            <span className="underline underline-offset-4">Settings</span>
            <img
              src="/icons/Gear.svg"
              alt=""
              aria-hidden
              width={18}
              height={18}
              className="w-[18px] h-[18px]"
            />
          </Link>
          <form action={kidSignOutAction}>
            <input type="hidden" name="slug" value={slug} />
            <button
              type="submit"
              className="font-semibold text-pp-primary underline underline-offset-4 hover:opacity-80"
            >
              Sign Out
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 px-4 sm:px-6 pb-10">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
