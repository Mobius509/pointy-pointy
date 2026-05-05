/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { clearKidSession, getKidSession } from "@/lib/v2/auth";
import {
  getActiveGoalForKid,
  getActiveRecurringTasks,
  getKidGoalProgress,
  getKidProfile,
  getKidProfiles,
  getKidRecentCompletions,
  getKidTodayCompletions,
} from "@/lib/v2/data";
import { ProgressVisual } from "@/app/_components/ProgressVisual";
import { RecentActivity } from "@/app/_components/RecentActivity";
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
      <Shell householdName={household.name as string}>
        <div className="max-w-2xl mx-auto">
          {kids.length === 0 ? (
            <div className="card text-center">
              <p className="text-slate-700">
                A parent hasn&apos;t set up any kids yet. Ask them to log in
                and add you!
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-orange-700 text-center mb-4">
                Who&apos;s here?
              </h1>
              <KidPicker slug={household.slug as string} kids={kids} />
            </>
          )}
        </div>
      </Shell>
    );
  }

  // Signed in — render this kid's checklist.
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
  const recent = await getKidRecentCompletions(
    household.id as string,
    kid.id,
    8,
  );
  const goal = await getActiveGoalForKid(household.id as string, kid.id);
  const progress = goal
    ? await getKidGoalProgress(household.id as string, kid.id, goal)
    : 0;

  // Map task → state (open / pending / approved) using this kid's completions.
  const stateByTaskId = new Map<string, "pending" | "approved">();
  for (const c of todayCompletions) {
    if (c.is_bonus || !c.task_id) continue;
    stateByTaskId.set(c.task_id, c.status);
  }
  const items = tasks.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    points: t.points,
    state: (stateByTaskId.get(t.id) ?? "open") as
      | "open"
      | "pending"
      | "approved",
  }));

  const pendingProposals = todayCompletions.filter(
    (c) => c.is_bonus && c.task_id === null && c.status === "pending",
  );

  return (
    <Shell householdName={household.name as string}>
      <div className="space-y-6 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-2xl" aria-hidden>
              {kid.avatar_emoji}
            </span>
            <span className="font-bold text-slate-800">Hi, {kid.name}!</span>
          </div>
          <form action={kidSignOutAction}>
            <input type="hidden" name="slug" value={slug} />
            <button type="submit" className="btn-secondary">
              Sign out
            </button>
          </form>
        </div>

        {goal ? (
          <ProgressVisual
            goalName={goal.name}
            current={progress}
            target={goal.target_points}
          />
        ) : (
          <section className="card text-center">
            <p className="text-slate-600">
              No active goal yet. Ask a parent to set one up!
            </p>
          </section>
        )}

        <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <section className="card">
              <h3 className="text-xl font-bold text-slate-800 mb-3">
                Today&apos;s tasks
              </h3>
              <V2DailyChecklist slug={slug} items={items} />
            </section>

            <V2KidProposal slug={slug} pendingProposals={pendingProposals} />
          </div>

          <section className="card md:self-start">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Recent</h3>
            <RecentActivity items={recent} />
          </section>
        </div>
      </div>
    </Shell>
  );
}

function Shell({
  children,
  householdName,
}: {
  children: React.ReactNode;
  householdName: string;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-amber-50 via-orange-50 to-rose-50">
      <header className="px-4 sm:px-6 pt-5 sm:pt-6 pb-3 sm:pb-4 max-w-6xl mx-auto w-full flex items-center justify-between">
        <Link href="/v2" className="inline-block group">
          <img
            src="/logos/Logo_Full.svg"
            alt="Pointy Points"
            className="h-10 sm:h-12 w-auto group-hover:animate-wiggle"
          />
        </Link>
        <span className="text-sm font-semibold text-slate-700">
          {householdName}
        </span>
      </header>
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 pb-24 pt-2">
        {children}
      </main>
    </div>
  );
}
