import { requireHouseholdAccess } from "@/lib/v2/auth";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import {
  getActiveGoalForKid,
  getActiveRecurringTasks,
  getHouseholdPendingCompletions,
  getKidCompletionsForPeriods,
  getKidGoalProgress,
  getKidProfiles,
} from "@/lib/v2/data";
import { computePeriodKey, type Frequency } from "@/lib/time";
import { FamilyStatsCard } from "./_components/FamilyStatsCard";
import { KidOverviewCard } from "./_components/KidOverviewCard";

export const dynamic = "force-dynamic";

export default async function ParentOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const household = await requireHouseholdAccess(slug);

  const [kids, tasks, pendingAll, activeGoalsResult] = await Promise.all([
    getKidProfiles(household.id),
    getActiveRecurringTasks(household.id),
    getHouseholdPendingCompletions(household.id),
    supabaseV2Admin
      .from("goals")
      .select("id", { count: "exact", head: true })
      .eq("household_id", household.id)
      .is("redeemed_at", null),
  ]);
  const goalCount = activeGoalsResult.count ?? 0;
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

      return { kid, goal, progress, pending, outstandingByFreq };
    }),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-[32px] font-medium text-[#D45B00] leading-none">
        Overview
      </h1>

      <FamilyStatsCard
        householdName={household.name}
        kids={kids}
        taskCount={tasks.length}
        goalCount={goalCount}
      />

      {kids.length === 0 ? (
        <section className="rounded-2xl bg-white p-6 text-center shadow-sm">
          <p className="text-slate-700">
            Get started by adding your first kid in Settings.
          </p>
        </section>
      ) : (
        kidCards.map(({ kid, goal, progress, pending, outstandingByFreq }) => (
          <KidOverviewCard
            key={kid.id}
            slug={slug}
            kid={kid}
            taskById={taskById}
            pending={pending}
            outstandingByFreq={outstandingByFreq}
            goal={goal}
            progress={progress}
          />
        ))
      )}
    </div>
  );
}
