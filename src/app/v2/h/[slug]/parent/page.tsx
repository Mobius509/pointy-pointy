import { requireHouseholdAccess } from "@/lib/v2/auth";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import {
  getActiveGoalForKid,
  getActiveRecurringTasks,
  getHouseholdPendingCompletions,
  getKidGoalProgress,
  getKidProfiles,
} from "@/lib/v2/data";
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

  // Per-kid: pending list + active goal + progress.
  const kidCards = await Promise.all(
    kids.map(async (kid) => {
      const goal = await getActiveGoalForKid(household.id, kid.id);
      const progress = goal
        ? await getKidGoalProgress(household.id, kid.id, goal)
        : 0;
      const pending = pendingAll.filter((c) => c.kid_profile_id === kid.id);
      return { kid, goal, progress, pending };
    }),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl sm:text-4xl font-extrabold text-orange-700">
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
        kidCards.map(({ kid, goal, progress, pending }) => (
          <KidOverviewCard
            key={kid.id}
            slug={slug}
            kid={kid}
            taskById={taskById}
            pending={pending}
            goal={goal}
            progress={progress}
          />
        ))
      )}
    </div>
  );
}
