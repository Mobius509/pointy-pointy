import {
  getActiveGoal,
  getActiveRecurringTasks,
  getGoalProgress,
  getRecentCompletions,
  getSettings,
  getTodayCompletions,
} from "@/lib/data";
import { ProgressVisual } from "@/app/_components/ProgressVisual";
import { DailyChecklist } from "@/app/_components/DailyChecklist";
import { KidProposal } from "@/app/_components/KidProposal";
import { RecentActivity } from "@/app/_components/RecentActivity";

export const dynamic = "force-dynamic";

export default async function Home() {
  const settings = await getSettings();
  const goal = await getActiveGoal();
  const tasks = await getActiveRecurringTasks();
  const todayCompletions = await getTodayCompletions(settings.timezone);
  const recent = await getRecentCompletions(8);

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
    state: (stateByTaskId.get(t.id) ?? "open") as "open" | "pending" | "approved",
  }));

  const pendingKidProposals = todayCompletions.filter(
    (c) => c.is_bonus && c.task_id === null && c.status === "pending",
  );

  const progress = goal ? await getGoalProgress(goal) : 0;

  return (
    <div className="space-y-6 pt-2">
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
            <DailyChecklist items={items} />
          </section>

          <KidProposal pendingProposals={pendingKidProposals} />
        </div>

        <section className="card md:self-start">
          <h3 className="text-xl font-bold text-slate-800 mb-2">Recent</h3>
          <RecentActivity items={recent} />
        </section>
      </div>
    </div>
  );
}
