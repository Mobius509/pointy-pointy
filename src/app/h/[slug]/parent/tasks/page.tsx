import { requireHouseholdAccess } from "@/lib/v2/auth";
import { getAllTasks } from "@/lib/v2/data";
import { frequencyLabel } from "@/lib/time";
import {
  createTaskAction,
  deleteTaskAction,
  moveTaskDownAction,
  moveTaskUpAction,
  updateTaskAction,
} from "../_actions/tasks";
import { PageTitle, SectionPill, SectionTitle } from "../_components/ui";

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
  const tasks = (await getAllTasks(household.id)).filter((t) => t.recurring);

  return (
    <div className="space-y-6 text-[14px]">
      <PageTitle>Tasks</PageTitle>

      {/* Add task */}
      <section className="card-warm">
        <SectionTitle>Add a task</SectionTitle>
        <p className="text-[#C3A38A] mt-1">
          New tasks appear on every kid&apos;s daily checklist.
        </p>
        <form
          action={createTaskAction}
          className="mt-4 grid gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="slug" value={slug} />
          <div className="sm:col-span-2">
            <label className="label-warm" htmlFor="new-name">
              Name
            </label>
            <input
              id="new-name"
              name="name"
              required
              className="input-warm"
              placeholder="Make bed"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label-warm" htmlFor="new-desc">
              Description (optional)
            </label>
            <input
              id="new-desc"
              name="description"
              className="input-warm"
              placeholder="Pillows up, blanket smooth"
            />
          </div>
          <div>
            <label className="label-warm" htmlFor="new-points">
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
              className="input-warm"
            />
          </div>
          <div>
            <label className="label-warm" htmlFor="new-frequency">
              How often
            </label>
            <select
              id="new-frequency"
              name="frequency"
              defaultValue="daily"
              className="input-warm"
            >
              {FREQUENCY_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {frequencyLabel(f)}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-warm-primary">
              Add task
            </button>
          </div>
        </form>
      </section>

      {/* Existing tasks */}
      <section className="card-warm">
        <SectionPill>Daily tasks</SectionPill>
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
                  className={`rounded-2xl ring-1 ring-[#F1D1BD]/70 p-3 ${
                    t.active ? "bg-[#FFFDF9]" : "bg-[#F9EBE3]/40 opacity-70"
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
                          className="grid place-items-center size-7 rounded-lg ring-1 ring-[#F1D1BD] bg-white text-[#F2662A] hover:bg-[#FFF7EE] disabled:opacity-30 disabled:cursor-not-allowed"
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
                          className="grid place-items-center size-7 rounded-lg ring-1 ring-[#F1D1BD] bg-white text-[#F2662A] hover:bg-[#FFF7EE] disabled:opacity-30 disabled:cursor-not-allowed"
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
                        <label className="label-warm">Name</label>
                        <input
                          name="name"
                          defaultValue={t.name}
                          required
                          className="input-warm"
                        />
                        <input
                          name="description"
                          defaultValue={t.description ?? ""}
                          placeholder="Description (optional)"
                          className="input-warm mt-2"
                        />
                      </div>
                      <div>
                        <label className="label-warm">Points</label>
                        <input
                          name="points"
                          type="number"
                          min={0}
                          max={1000}
                          defaultValue={t.points}
                          className="input-warm"
                        />
                      </div>
                      <div>
                        <label className="label-warm">How often</label>
                        <select
                          name="frequency"
                          defaultValue={t.frequency}
                          className="input-warm"
                        >
                          {FREQUENCY_OPTIONS.map((f) => (
                            <option key={f} value={f}>
                              {frequencyLabel(f)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <label className="flex items-center gap-2 text-[#F2662A] font-semibold">
                        <input
                          type="checkbox"
                          name="active"
                          defaultChecked={t.active}
                          className="accent-[#F2662A]"
                        />
                        Active
                      </label>
                      <div className="sm:col-span-4 flex gap-2">
                        <button type="submit" className="btn-warm-primary">
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
    </div>
  );
}
