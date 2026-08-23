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
              <p className="text-[#F2662A]">
                A parent hasn&apos;t set up any kids yet. Ask them to log in
                and add you!
              </p>
            </div>
          ) : (
            <>
              {kids.length > 1 && (
                <h1 className="text-[32px] font-medium text-[#F2662A] text-center mb-4">
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
            className="mt-1 text-[#F2662A] leading-tight text-center"
            style={{ fontSize: 26, fontWeight: 700 }}
          >
            {displayName}
          </h1>
        </div>

        <div className="mt-6 space-y-6">
          {/* Progress card */}
        {goal && (
          <section className="bg-white rounded-[32px] px-4 sm:px-6 py-6 sm:py-10 shadow-sm">
            {/* Mobile: vertical stack — icon+name, then bar, then footer.
                Desktop: original single-row layout with absolutely
                positioned milestone labels and footer. */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
              {/* Icon + goal name. */}
              <div className="flex items-center gap-3 sm:gap-5 min-w-0">
                <span className="text-3xl sm:text-4xl flex-shrink-0" aria-hidden>
                  🐶
                </span>
                <span
                  className="flex-shrink-0 text-[#B64B11]"
                  style={{ fontSize: 16, fontWeight: 500 }}
                >
                  {goal.name}
                </span>
              </div>

              {/* Bar + its labels/footer. On desktop the labels above
                  and the footer below are absolutely positioned. On
                  mobile they flow naturally as block rows. */}
              <div className="relative flex-1 sm:min-w-[160px] sm:h-8">
                {/* Milestone name labels — desktop only (above the bar).
                    Hidden on mobile to avoid clipping/overlap. */}
                <div
                  className="hidden sm:block absolute inset-x-0 pointer-events-none h-4"
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
                          unlocked ? "text-[#F2662A]" : "text-[#C3A38A]"
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
                <div className="rounded-full bg-[#F1D1BD] px-1 flex items-center h-8 sm:h-full">
                  <div className="relative h-6 w-full">
                    <div
                      className="absolute inset-y-0 left-0 bg-[#F2662A] rounded-full flex items-center justify-center text-white tabular-nums font-semibold transition-[width] duration-500 ease-out"
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
                              ? "size-2.5 bg-white ring-2 ring-[#F2662A]"
                              : "size-1.5 bg-[#F2662A]/40"
                          }`}
                          style={{ left: `${left}%`, top: "50%" }}
                        />
                      );
                    })}
                  </div>
                </div>
                {/* Mobile footer — flows below the bar as a flex row.
                    On desktop the absolute-positioned footer below
                    handles this with the % indicator anchored to the
                    progress edge. */}
                <div
                  className="flex sm:hidden items-center justify-between mt-2 text-[#F2662A] tabular-nums"
                  style={{ fontSize: 12, fontWeight: 600 }}
                >
                  <span>{goalPct}% There</span>
                  <span>
                    {remaining.toLocaleString()} points to go
                  </span>
                </div>
                {/* Desktop footer — absolutely positioned 8px below. */}
                <div
                  className="hidden sm:block absolute inset-x-0 h-4"
                  style={{ top: "calc(100% + 8px)" }}
                >
                  <span
                    className="absolute -translate-x-1/2 text-[#F2662A] tabular-nums"
                    style={{
                      left: `max(${goalPct}%, 3rem)`,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {goalPct}% There
                  </span>
                  <span
                    className="absolute right-0 text-[#F2662A] tabular-nums"
                    style={{ fontSize: 12, fontWeight: 600 }}
                  >
                    {remaining.toLocaleString()} points to go
                  </span>
                </div>
              </div>

              {/* Target — desktop only. On mobile the "points to go"
                  footer already conveys the gap. */}
              <span
                className="hidden sm:inline flex-shrink-0 text-[#F2662A] tabular-nums"
                style={{ fontSize: 16, fontWeight: 500 }}
              >
                {goal.target_points.toLocaleString()}
              </span>
            </div>
          </section>
        )}

        {/* Tasks list */}
        <section className="bg-white rounded-[32px] p-4 sm:p-6 shadow-sm">
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
        background: "#FFF2E9",
      }}
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
            className="inline-flex items-center gap-1.5 font-semibold text-[#F2662A] hover:opacity-80"
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
              className="font-semibold text-[#F2662A] underline underline-offset-4 hover:opacity-80"
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
