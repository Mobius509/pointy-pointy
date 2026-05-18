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
} from "@/lib/v2/data";
import { computePeriodKey } from "@/lib/time";
import { KidPicker } from "./_components/KidPicker";
import { V2DailyChecklist } from "./_components/V2DailyChecklist";
import { V2KidProposal } from "./_components/V2KidProposal";
import { kidSignOutAction } from "./_actions/kid-session";

export const dynamic = "force-dynamic";

// Map the kid's avatar_emoji to the matching emoji PNG. Falls back to the
// dog illustration when the picker hasn't been built yet.
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

function buildMilestones(target: number): number[] {
  if (target <= 0) return [];
  return [0.2, 0.4, 0.8].map((frac) => {
    const raw = target * frac;
    const step = target >= 1000 ? 100 : target >= 100 ? 10 : 1;
    return Math.round(raw / step) * step;
  });
}

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
  const milestones = goal ? buildMilestones(goal.target_points) : [];

  return (
    <Shell slug={slug}>
      <div className="space-y-6">
        {/* Profile row: avatar (left), name + family (left text), points (right) */}
        <div className="flex flex-wrap items-center gap-4 px-2">
          <img
            src={avatarSrc(kid.avatar_emoji)}
            alt=""
            aria-hidden
            className="w-28 h-28 sm:w-32 sm:h-32 object-contain"
          />
          <div className="flex-1 min-w-0">
            <h1
              className="text-[#D45B00] leading-tight"
              style={{ fontSize: 26, fontWeight: 700 }}
            >
              {fullName}
            </h1>
          </div>
          <div className="text-right">
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

        {/* Progress card */}
        {goal && (
          <section className="bg-white rounded-[32px] p-5 sm:p-7 shadow-sm">
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

              <div className="relative flex-1 min-w-[160px]">
                {/* Milestone labels above */}
                <div
                  className="absolute inset-x-0 pointer-events-none h-4"
                  style={{ bottom: "calc(100% + 6px)" }}
                >
                  {milestones.map((m) => {
                    const left = Math.min(
                      100,
                      Math.max(0, (m / goal.target_points) * 100),
                    );
                    return (
                      <span
                        key={m}
                        className="absolute -translate-x-1/2 text-[#C3A38A] tabular-nums"
                        style={{ left: `${left}%`, fontSize: 12, fontWeight: 500 }}
                      >
                        {m.toLocaleString()}
                      </span>
                    );
                  })}
                </div>
                {/* The track */}
                <div className="relative h-5 rounded-full bg-[#F1D1BD]">
                  <div
                    className="absolute inset-y-0 left-0 bg-[#D45B00] rounded-full transition-[width] duration-500 ease-out"
                    style={{ width: `${goalPct}%` }}
                  />
                  {/* Current-points pill sits at the end of the orange fill */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 rounded-full bg-[#D45B00] text-white tabular-nums font-semibold px-3 py-1 leading-none"
                    style={{
                      left: `calc(${goalPct}% - 1.6rem)`,
                      fontSize: 12,
                      minWidth: "3rem",
                      textAlign: "center",
                    }}
                  >
                    {progress.toLocaleString()}
                  </div>
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
            <div className="mt-3 flex justify-between">
              <span
                className="text-[#D45B00]"
                style={{ fontSize: 12, fontWeight: 600 }}
              >
                {goalPct}% There
              </span>
              <span
                className="text-[#D45B00] tabular-nums"
                style={{ fontSize: 12, fontWeight: 600 }}
              >
                {remaining.toLocaleString()} points to go
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
            href={`/v2/h/${slug}/parent/settings`}
            className="inline-flex items-center gap-1 font-semibold text-[#D45B00] underline underline-offset-4 hover:opacity-80"
          >
            Settings
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              fill="currentColor"
              className="size-3.5 opacity-80"
            >
              <path d="M8 1.5a1 1 0 00-1 1v.7a5.5 5.5 0 00-1.5.62l-.5-.49a1 1 0 00-1.42 0l-.7.71a1 1 0 000 1.41l.5.5A5.5 5.5 0 003.2 7H2.5a1 1 0 00-1 1v1a1 1 0 001 1h.7a5.5 5.5 0 00.62 1.5l-.49.5a1 1 0 000 1.42l.71.7a1 1 0 001.41 0l.5-.5A5.5 5.5 0 007 12.8v.7a1 1 0 001 1h1a1 1 0 001-1v-.7a5.5 5.5 0 001.5-.62l.5.49a1 1 0 001.42 0l.7-.71a1 1 0 000-1.41l-.5-.5A5.5 5.5 0 0012.8 9h.7a1 1 0 001-1V7a1 1 0 00-1-1h-.7a5.5 5.5 0 00-.62-1.5l.49-.5a1 1 0 000-1.42l-.71-.7a1 1 0 00-1.41 0l-.5.5A5.5 5.5 0 009 3.2V2.5a1 1 0 00-1-1zm.5 5a2 2 0 110 4 2 2 0 010-4z" />
            </svg>
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
        <div className="mx-auto w-full max-w-4xl">{children}</div>
      </main>
    </div>
  );
}
