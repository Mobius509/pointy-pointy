import { requireHouseholdAccess } from "@/lib/v2/auth";
import {
  getActiveGoalForKid,
  getActiveRecurringTasks,
  getHouseholdPendingCompletions,
  getKidCompletionsForPeriods,
  getKidGoalProgress,
  getKidProfiles,
  getKidRecentCompletions,
  getMilestonesForGoal,
} from "@/lib/v2/data";
import { computePeriodKey, type Frequency } from "@/lib/time";
import { KidOverviewCard } from "./_components/KidOverviewCard";
import { PageTitle } from "./_components/ui";

export const dynamic = "force-dynamic";

export default async function ParentOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const household = await requireHouseholdAccess(slug);

  const [kids, tasks, pendingAll] = await Promise.all([
    getKidProfiles(household.id),
    getActiveRecurringTasks(household.id),
    getHouseholdPendingCompletions(household.id),
  ]);
  const taskById = new Map(tasks.map((t) => [t.id, t]));

  // Pre-compute period keys per task — same value for tasks of the same
  // frequency, but cached per task for downstream lookups.
  const tz = household.timezone;
  const periodKeyByTask = new Map<string, string>(
    tasks.map((t) => [t.id, computePeriodKey(t.frequency, tz)]),
  );
  const distinctPeriodKeys = [...new Set(periodKeyByTask.values())];

  // Per-kid: pending list, active goal + progress, and the set of tasks the
  // kid hasn't yet acted on this period (those are 'outstanding').
  const kidCards = await Promise.all(
    kids.map(async (kid) => {
      const goal = await getActiveGoalForKid(household.id, kid.id);
      const progress = goal
        ? await getKidGoalProgress(household.id, kid.id, goal)
        : 0;
      const milestones = goal
        ? await getMilestonesForGoal(household.id, goal.id)
        : [];
      const pending = pendingAll.filter((c) => c.kid_profile_id === kid.id);

      const periodCompletions = await getKidCompletionsForPeriods(
        household.id,
        kid.id,
        distinctPeriodKeys,
      );
      // Track tasks that have any completion (pending or approved) for the
      // current period — those are NOT outstanding.
      const acted = new Set<string>();
      for (const c of periodCompletions) {
        if (c.is_bonus || !c.task_id) continue;
        if (periodKeyByTask.get(c.task_id) === c.period_key) {
          acted.add(c.task_id);
        }
      }
      const outstandingByFreq = new Map<Frequency, typeof tasks>();
      for (const t of tasks) {
        if (acted.has(t.id)) continue;
        const arr = outstandingByFreq.get(t.frequency) ?? [];
        arr.push(t);
        outstandingByFreq.set(t.frequency, arr);
      }

      // Last 8 approved items for the kid — feeds the 'Previously Approved'
      // strip. Fetch a few extra and filter to approved in case there's a
      // recent pending row in front.
      const recent = await getKidRecentCompletions(household.id, kid.id, 30);
      const recentApproved = recent
        .filter((c) => c.status === "approved")
        .slice(0, 8);

      return {
        kid,
        goal,
        progress,
        milestones,
        pending,
        outstandingByFreq,
        recentApproved,
      };
    }),
  );

  return (
    <div className="space-y-6">
      <PageTitle>Review</PageTitle>

      {kids.length === 0 ? (
        <section className="rounded-2xl bg-white p-6 text-center shadow-sm">
          <p className="text-slate-700">
            Get started by adding your first kid in Settings.
          </p>
        </section>
      ) : (
        kidCards.map(
          ({
            kid,
            goal,
            progress,
            milestones,
            pending,
            outstandingByFreq,
            recentApproved,
          }) => (
            <KidOverviewCard
              key={kid.id}
              slug={slug}
              kid={kid}
              taskById={taskById}
              pending={pending}
              outstandingByFreq={outstandingByFreq}
              recentApproved={recentApproved}
              goal={goal}
              progress={progress}
              milestones={milestones}
            />
          ),
        )
      )}
    </div>
  );
}
