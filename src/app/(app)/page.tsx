import {
  getActiveGoal,
  getActiveRecurringTasks,
  getGoalProgress,
  getOpenAndTodayCompletions,
  getRecentCompletions,
  getSettings,
} from "@/lib/data";
import { todayInTimezone } from "@/lib/time";
import { ProgressVisual } from "@/app/_components/ProgressVisual";
import { DailyChecklist } from "@/app/_components/DailyChecklist";
import { KidProposal } from "@/app/_components/KidProposal";
import { PushToggle } from "@/app/_components/PushToggle";
import { RecentActivity } from "@/app/_components/RecentActivity";

export const dynamic = "force-dynamic";

export default async function Home() {
  const settings = await getSettings();
  const goal = await getActiveGoal();
  const tasks = await getActiveRecurringTasks();
  const completions = await getOpenAndTodayCompletions(settings.timezone);
  const recent = await getRecentCompletions(8);
  const today = todayInTimezone(settings.timezone);

  // For each task, derive state:
  //   - "pending" if any unresolved submission exists (any date)
  //   - "approved" if there's an approved completion completed_on=today
  //   - else "open"
  // Pending wins over approved so the kid sees their submission persist.
  const stateByTaskId = new Map<string, "pending" | "approved">();
  const submittedAtByTaskId = new Map<string, string>();
  for (const c of completions) {
    if (c.is_bonus || !c.task_id) continue;
    if (c.status === "pending") {
      stateByTaskId.set(c.task_id, "pending");
      submittedAtByTaskId.set(c.task_id, c.completed_at);
    } else if (
      c.status === "approved" &&
      c.completed_on === today &&
      stateByTaskId.get(c.task_id) !== "pending"
    ) {
      stateByTaskId.set(c.task_id, "approved");
      submittedAtByTaskId.set(c.task_id, c.completed_at);
    }
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
    submittedAt: submittedAtByTaskId.get(t.id) ?? null,
  }));

  // Kid bonus proposals: any still-pending one (regardless of date) sticks
  // around in the kid's "Waiting on" panel until a parent acts.
  const pendingKidProposals = completions.filter(
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

        <div className="space-y-6 md:self-start">
          <section className="card">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Recent</h3>
            <RecentActivity items={recent} />
          </section>
          <section className="card">
            <PushToggle role="kid" label="Tell me when a parent approves" />
          </section>
        </div>
      </div>
    </div>
  );
}
