/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { clearKidSession, getKidSession } from "@/lib/v2/auth";
import {
  getActiveGoalForKid,
  getActiveRecurringTasks,
  getKidCompletionsForPeriods,
  getKidGoalProgress,
  getKidProfile,
  getKidProfiles,
  getKidTodayCompletions,
  getMilestonesForGoal,
} from "@/lib/v2/data";
import { computePeriodKey } from "@/lib/time";
import { avatarSrc } from "@/lib/avatar";
import { KidPicker } from "./_components/KidPicker";
import { V2DailyChecklist } from "./_components/V2DailyChecklist";
import { V2KidProposal } from "./_components/V2KidProposal";
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

  // Not signed in — show kid picker + PIN.
  if (!sessionMatchesHousehold) {
    const kids = await getKidProfiles(household.id as string);
    return (
      <Shell slug={slug}>
        <div className="max-w-2xl mx-auto pt-6">
          {kids.length === 0 ? (
            <div className="bg-white rounded-[32px] p-6 text-center">
              <p className="text-[#733405]">
                A parent hasn&apos;t set up any kids yet. Ask them to log in
                and add you!
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-[32px] font-medium text-[#D45B00] text-center mb-4">
                Who&apos;s here?
              </h1>
              <KidPicker slug={household.slug as string} kids={kids} />
            </>
          )}
        </div>
      </Shell>
    );
  }

  // Signed in — load the kid + today's checklist.
  const kid = await getKidProfile(session.kidProfileId);
  if (!kid) {
    await clearKidSession();
    notFound();
  }

  const tasks = await getActiveRecurringTasks(household.id as string);
  const todayCompletions = await getKidTodayCompletions(
    household.id as string,
    kid.id,
    household.timezone as string,
  );
  const goal = await getActiveGoalForKid(household.id as string, kid.id);
  const progress = goal
    ? await getKidGoalProgress(household.id as string, kid.id, goal)
    : 0;
  const milestones = goal
    ? await getMilestonesForGoal(household.id as string, goal.id)
    : [];

  const tz = household.timezone as string;
  const taskPeriodKey = new Map<string, string>(
    tasks.map((t) => [t.id, computePeriodKey(t.frequency, tz)]),
  );
  const distinctPeriodKeys = [...new Set(taskPeriodKey.values())];
  const periodCompletions = await getKidCompletionsForPeriods(
    household.id as string,
    kid.id,
    distinctPeriodKeys,
  );

  const stateByTaskId = new Map<string, "pending" | "approved">();
  for (const c of periodCompletions) {
    if (c.is_bonus || !c.task_id) continue;
    if (taskPeriodKey.get(c.task_id) === c.period_key) {
      stateByTaskId.set(c.task_id, c.status);
    }
  }
  const items = tasks.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    points: t.points,
    frequency: t.frequency,
    state: (stateByTaskId.get(t.id) ?? "open") as
      | "open"
      | "pending"
      | "approved",
  }));

  const pendingProposals = todayCompletions.filter(
    (c) => c.is_bonus && c.task_id === null && c.status === "pending",
  );

  const fullName = `${kid.name} ${household.name as string}`;
  const remaining = goal
    ? Math.max(0, goal.target_points - progress)
    : 0;
  const goalPct = goal
    ? Math.min(100, Math.round((progress / Math.max(1, goal.target_points)) * 100))
    : 0;

  return (
    <Shell slug={slug}>
      {/* Outer translucent panel — same shell treatment as the parent admin.
          The avatar sits half above / half inside the panel; the name
          appears directly beneath it, and 'Current Points' sits in the
          top-right of the panel. */}
      <div className="relative bg-white/60 backdrop-blur-md rounded-[32px] px-6 sm:px-10 pt-0 pb-6 sm:pb-10 mt-24 sm:mt-28">
        <div className="grid grid-cols-[auto_1fr] gap-x-4 sm:gap-x-6 items-start">
          {/* Left column: avatar (negative top margin pushes it half above
              the panel) + the kid's full name directly beneath. */}
          <div className="flex flex-col items-start">
            <img
              src={avatarSrc(kid.avatar_emoji)}
              alt=""
              aria-hidden
              className="block w-40 h-40 -mt-20 object-contain"
            />
            <h1
              className="mt-1 text-[#D45B00] leading-tight"
              style={{ fontSize: 26, fontWeight: 700 }}
            >
              {fullName}
            </h1>
          </div>

          {/* Right column: 'Current Points'. */}
          <div className="text-right pt-4 sm:pt-6">
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
          </div>
        </div>

        <div className="mt-6 space-y-6">
          {/* Progress card */}
        {goal && (
          <section className="bg-white rounded-[32px] px-5 sm:px-8 py-[50px] shadow-sm">
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

              {/* Bar wrapper height === bar height so flex items-center on the
                  parent aligns the emoji/label/target with the bar's
                  centerline. Milestone labels (above) and the footer (below)
                  are absolutely positioned so they don't change the wrapper
                  height. */}
              <div className="relative flex-1 min-w-[160px] h-8">
                {/* Milestone labels — 8px above the bar */}
                <div
                  className="absolute inset-x-0 pointer-events-none h-4"
                  style={{ bottom: "calc(100% + 8px)" }}
                >
                  {milestones.map((m) => {
                    const left = Math.min(
                      100,
                      Math.max(0, (m.points / goal.target_points) * 100),
                    );
                    const unlocked = progress >= m.points;
                    return (
                      <span
                        key={m.id}
                        className={`absolute -translate-x-1/2 whitespace-nowrap ${
                          unlocked ? "text-[#D45B00]" : "text-[#C3A38A]"
                        }`}
                        style={{
                          left: `${left}%`,
                          fontSize: 12,
                          fontWeight: unlocked ? 600 : 500,
                        }}
                        title={`${m.name} · ${m.points.toLocaleString()} pts`}
                      >
                        {m.name}
                      </span>
                    );
                  })}
                </div>
                {/* Bar */}
                <div className="rounded-full bg-[#F1D1BD] px-1 flex items-center h-full">
                  <div className="relative h-6 w-full">
                    <div
                      className="absolute inset-y-0 left-0 bg-[#D45B00] rounded-full flex items-center justify-center text-white tabular-nums font-semibold transition-[width] duration-500 ease-out"
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
                          className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ${
                            unlocked
                              ? "size-2.5 bg-white ring-2 ring-[#D45B00]"
                              : "size-1.5 bg-[#D45B00]/40"
                          }`}
                          style={{ left: `${left}%`, top: "50%" }}
                        />
                      );
                    })}
                  </div>
                </div>
                {/* Footer — 8px below the bar */}
                <div
                  className="absolute inset-x-0 h-4"
                  style={{ top: "calc(100% + 8px)" }}
                >
                  <span
                    className="absolute -translate-x-1/2 text-[#D45B00] tabular-nums"
                    style={{
                      left: `max(${goalPct}%, 3rem)`,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {goalPct}% There
                  </span>
                  <span
                    className="absolute right-0 text-[#D45B00] tabular-nums"
                    style={{ fontSize: 12, fontWeight: 600 }}
                  >
                    {remaining.toLocaleString()} points to go
                  </span>
                </div>
              </div>

              <span
                className="flex-shrink-0 text-[#733405] tabular-nums"
                style={{ fontSize: 16, fontWeight: 500 }}
              >
                {goal.target_points.toLocaleString()}
              </span>
            </div>
          </section>
        )}

        {/* Tasks list */}
        <section className="bg-white rounded-[32px] p-5 sm:p-8 shadow-sm">
          <V2DailyChecklist slug={slug} items={items} />
        </section>

          {/* Did something extra? */}
          <V2KidProposal slug={slug} pendingProposals={pendingProposals} />
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
      className="relative min-h-screen flex flex-col"
      style={{
        background: "linear-gradient(180deg, #E6BA9D 0%, #FFF2E9 100%)",
      }}
    >
      <header className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-6 sm:px-8 py-5">
        <Link href="/v2" aria-label="Pointy Points home" className="group">
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
            href={`/v2/h/${slug}/settings`}
            className="inline-flex items-center gap-1.5 font-semibold text-[#D45B00] hover:opacity-80"
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
              className="font-semibold text-[#D45B00] underline underline-offset-4 hover:opacity-80"
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
