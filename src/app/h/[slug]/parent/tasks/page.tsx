import { requireHouseholdAccess } from "@/lib/v2/auth";
import { getAllTasks, getKidProfiles, type V2Task } from "@/lib/v2/data";
import { getKidStreaks, getStreaks, type Streak } from "@/lib/v2/streaks";
import { frequencyLabel } from "@/lib/time";
import {
  createTaskAction,
  deleteTaskAction,
  moveTaskDownAction,
  moveTaskUpAction,
  updateTaskAction,
} from "../_actions/tasks";
import { createStreakAction, updateStreakAction } from "../_actions/streaks";
import { DeleteStreakButton } from "../_components/DeleteStreakButton";
import { AccordionCard, PageTitle, SectionTitle } from "../_components/ui";

export const dynamic = "force-dynamic";

const FREQUENCY_OPTIONS = [
  "daily",
  "weekly",
  "biweekly",
  "monthly",
  "yearly",
] as const;

export default async function ParentTasksPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const household = await requireHouseholdAccess(slug);
  const [allTasks, streaks, kids] = await Promise.all([
    getAllTasks(household.id),
    getStreaks(household.id),
    getKidProfiles(household.id),
  ]);
  const tasks = allTasks.filter((t) => t.recurring);
  // Streaks are "days in a row", so they're built from daily tasks.
  const dailyTasks = tasks.filter((t) => t.frequency === "daily");
  // Each kid's current run on each streak ("Freya 🔥 4 days · reward in 3").
  const progress = await Promise.all(
    kids.map(async (kid) => ({
      kid,
      runs: new Map(
        (await getKidStreaks({ householdId: household.id, kidProfileId: kid.id, timezone: household.timezone })).map(
          (ks) => [ks.streak.id, ks.run.length],
        ),
      ),
    })),
  );

  return (
    <div className="space-y-6 text-[14px]">
      <PageTitle>Tasks</PageTitle>

      <AccordionCard title="Tasks" summary={`${tasks.length} task${tasks.length === 1 ? "" : "s"}`} defaultOpen>
      {/* Add task */}
      <section className="rounded-2xl ring-1 ring-pp-line/70 p-4">
        <SectionTitle>Add a task</SectionTitle>
        <p className="text-pp-muted mt-1">
          New tasks appear on every kid&apos;s daily checklist.
        </p>
        <form
          action={createTaskAction}
          className="mt-4 grid gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="slug" value={slug} />
          <div className="sm:col-span-2">
            <label className="label" htmlFor="new-name">
              Name
            </label>
            <input
              id="new-name"
              name="name"
              required
              className="input"
              placeholder="Make bed"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="new-desc">
              Description (optional)
            </label>
            <input
              id="new-desc"
              name="description"
              className="input"
              placeholder="Pillows up, blanket smooth"
            />
          </div>
          <div>
            <label className="label" htmlFor="new-points">
              Points
            </label>
            <input
              id="new-points"
              name="points"
              type="number"
              min={0}
              max={1000}
              defaultValue={5}
              required
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="new-frequency">
              How often
            </label>
            <select
              id="new-frequency"
              name="frequency"
              defaultValue="daily"
              className="input"
            >
              {FREQUENCY_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {frequencyLabel(f)}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-soft">
              Add task
            </button>
          </div>
        </form>
      </section>

      {/* Existing tasks */}
      <section className="mt-6">
        <SectionTitle>Your tasks</SectionTitle>
        {tasks.length === 0 ? (
          <p className="mt-3 text-slate-500 italic">No daily tasks yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {tasks.map((t, i) => {
              const isFirst = i === 0;
              const isLast = i === tasks.length - 1;
              return (
                <li
                  key={t.id}
                  className={`rounded-2xl ring-1 ring-pp-line/70 p-3 ${
                    t.active ? "bg-pp-hover" : "bg-pp-soft/40 opacity-70"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex flex-col gap-1 pt-7">
                      <form action={moveTaskUpAction}>
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="id" value={t.id} />
                        <button
                          type="submit"
                          disabled={isFirst}
                          aria-label="Move up"
                          className="grid place-items-center size-7 rounded-lg ring-1 ring-pp-line bg-white text-pp-primary hover:bg-pp-hover disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          ▲
                        </button>
                      </form>
                      <form action={moveTaskDownAction}>
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="id" value={t.id} />
                        <button
                          type="submit"
                          disabled={isLast}
                          aria-label="Move down"
                          className="grid place-items-center size-7 rounded-lg ring-1 ring-pp-line bg-white text-pp-primary hover:bg-pp-hover disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          ▼
                        </button>
                      </form>
                    </div>

                    <form
                      action={updateTaskAction}
                      className="flex-1 grid gap-2 sm:grid-cols-[1fr_5rem_7rem_auto] sm:items-end"
                    >
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="id" value={t.id} />
                      <div>
                        <label className="label">Name</label>
                        <input
                          name="name"
                          defaultValue={t.name}
                          required
                          className="input"
                        />
                        <input
                          name="description"
                          defaultValue={t.description ?? ""}
                          placeholder="Description (optional)"
                          className="input mt-2"
                        />
                      </div>
                      <div>
                        <label className="label">Points</label>
                        <input
                          name="points"
                          type="number"
                          min={0}
                          max={1000}
                          defaultValue={t.points}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="label">How often</label>
                        <select
                          name="frequency"
                          defaultValue={t.frequency}
                          className="input"
                        >
                          {FREQUENCY_OPTIONS.map((f) => (
                            <option key={f} value={f}>
                              {frequencyLabel(f)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <label className="flex items-center gap-2 text-pp-primary font-semibold">
                        <input
                          type="checkbox"
                          name="active"
                          defaultChecked={t.active}
                          className="accent-pp-primary"
                        />
                        Active
                      </label>
                      <div className="sm:col-span-4 flex gap-2">
                        <button type="submit" className="btn-soft">
                          Save
                        </button>
                      </div>
                    </form>
                  </div>
                  <form action={deleteTaskAction} className="mt-2">
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="id" value={t.id} />
                    <button
                      type="submit"
                      className="text-xs text-rose-600 hover:underline"
                    >
                      Delete permanently
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      </AccordionCard>

      <AccordionCard
        title="Streaks"
        summary={streaks.length ? `${streaks.length} streak${streaks.length === 1 ? "" : "s"}` : "Bonus points + game unlocks"}
      >
        <p className="text-pp-muted">
          Pick daily tasks to do every day — all of them, or any few of them. Each time a kid keeps it up for the number of days you set, they get the
          bonus points and an arcade ticket. Tickets save up; each one plays a mini game while a streak is going — a
          surprise game, or one they pick once a streak has run two weeks. Missing a day starts it over.
        </p>

        {streaks.length > 0 && (
          <ul className="mt-4 space-y-3">
            {streaks.map((s) => (
              <li
                key={s.id}
                className={`rounded-2xl ring-1 ring-pp-line/70 p-3 ${s.active ? "bg-pp-hover" : "bg-pp-soft/40 opacity-70"}`}
              >
                {progress.length > 0 && s.active && (
                  <p className="mb-2 font-semibold text-pp-primary">
                    {progress
                      .map(({ kid, runs }) => {
                        const days = runs.get(s.id) ?? 0;
                        const toGo = s.days_required - (days % s.days_required);
                        return `${kid.name} 🔥 ${days} day${days === 1 ? "" : "s"} · reward in ${toGo}`;
                      })
                      .join(" · ")}
                  </p>
                )}
                <form action={updateStreakAction}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={s.id} />
                  <StreakFields streak={s} dailyTasks={dailyTasks} idPrefix={`streak-${s.id}`} />
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-pp-primary font-semibold">
                      <input type="checkbox" name="active" defaultChecked={s.active} className="accent-pp-primary" />
                      Active
                    </label>
                    <button type="submit" className="btn-soft">
                      Save
                    </button>
                  </div>
                </form>
                <div className="mt-2">
                  <DeleteStreakButton slug={slug} id={s.id} name={s.name} />
                </div>
              </li>
            ))}
          </ul>
        )}

        <section className="mt-6 rounded-2xl ring-1 ring-pp-line/70 p-4">
          <SectionTitle>Add a streak</SectionTitle>
          {dailyTasks.length === 0 ? (
            <p className="mt-2 text-pp-muted italic">Add a daily task first — streaks are built from daily tasks.</p>
          ) : (
            <form action={createStreakAction} className="mt-3">
              <input type="hidden" name="slug" value={slug} />
              <StreakFields dailyTasks={dailyTasks} idPrefix="new-streak" />
              <button type="submit" className="btn-soft mt-3">
                Add streak
              </button>
            </form>
          )}
        </section>
      </AccordionCard>
    </div>
  );
}

// Name, which daily tasks (and how many of them a day needs), days in a
// row, bonus points — for adding and editing a streak.
function StreakFields({
  streak,
  dailyTasks,
  idPrefix,
}: {
  streak?: Streak;
  dailyTasks: V2Task[];
  idPrefix: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="label" htmlFor={`${idPrefix}-name`}>
          Streak name
        </label>
        <input
          id={`${idPrefix}-name`}
          name="name"
          required
          defaultValue={streak?.name}
          placeholder="Morning routine"
          className="input"
        />
      </div>
      <fieldset className="sm:col-span-2">
        <legend className="label">Tasks in this streak</legend>
        <div className="flex flex-wrap gap-2">
          {dailyTasks.map((t) => (
            <label
              key={t.id}
              className="flex items-center gap-2 rounded-full bg-white ring-1 ring-pp-line px-3 py-1.5 text-pp-primary font-medium has-[:checked]:bg-pp-tint has-[:checked]:ring-pp-primary"
            >
              <input
                type="checkbox"
                name="task_ids"
                value={t.id}
                defaultChecked={streak?.taskIds.includes(t.id)}
                className="accent-pp-primary"
              />
              {t.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="sm:col-span-2">
        <label className="label" htmlFor={`${idPrefix}-needed`}>
          How many of these each day
        </label>
        <input
          id={`${idPrefix}-needed`}
          name="tasks_needed"
          type="number"
          min={1}
          max={50}
          defaultValue={streak?.tasks_needed ?? ""}
          placeholder="All of them"
          className="input max-w-[12rem]"
        />
        <p className="mt-1 text-[12px] text-pp-muted">
          Leave blank to need every task. Pick 3 of 4 and any three count (no lunch on Fridays? reading instead
          is fine).
        </p>
      </div>
      <div>
        <label className="label" htmlFor={`${idPrefix}-days`}>
          Days in a row for a reward
        </label>
        <input
          id={`${idPrefix}-days`}
          name="days_required"
          type="number"
          min={2}
          max={365}
          defaultValue={streak?.days_required ?? 7}
          required
          className="input"
        />
      </div>
      <div>
        <label className="label" htmlFor={`${idPrefix}-bonus`}>
          Bonus points
        </label>
        <input
          id={`${idPrefix}-bonus`}
          name="bonus_points"
          type="number"
          min={0}
          max={1000}
          defaultValue={streak?.bonus_points ?? 10}
          required
          className="input"
        />
      </div>
      <label className="sm:col-span-2 flex items-center gap-2 text-pp-primary font-semibold">
        <input
          type="checkbox"
          name="skip_weekends"
          defaultChecked={streak?.skip_weekends ?? false}
          className="accent-pp-primary"
        />
        Skip weekends
        <span className="font-normal text-pp-muted">— school days only; Sat &amp; Sun don&apos;t count or break it</span>
      </label>
    </div>
  );
}
