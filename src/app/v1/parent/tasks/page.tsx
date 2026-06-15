import { getAllTasks } from "@/lib/data";
import {
  createTaskAction,
  deleteTaskAction,
  moveTaskDownAction,
  moveTaskUpAction,
  updateTaskAction,
} from "../_actions/tasks";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const tasks = (await getAllTasks()).filter((t) => t.recurring);

  return (
    <div className="space-y-4">
      <section className="card">
        <h2 className="text-lg font-bold text-slate-800">Add a task</h2>
        <p className="text-sm text-slate-600 mt-1">
          New tasks appear on the daily checklist every day.
        </p>
        <form
          action={createTaskAction}
          className="mt-3 grid gap-3 sm:grid-cols-2"
        >
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
          <div className="sm:col-span-2">
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
          <input type="hidden" name="recurring" value="on" />
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary">
              Add task
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <h2 className="text-lg font-bold text-slate-800 mb-3">Daily tasks</h2>
        {tasks.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No daily tasks yet.</p>
        ) : (
          <ul className="space-y-3">
            {tasks.map((t, i) => {
              const isFirst = i === 0;
              const isLast = i === tasks.length - 1;
              return (
                <li
                  key={t.id}
                  className={`rounded-xl ring-1 ring-slate-200 p-3 ${
                    t.active ? "bg-white" : "bg-slate-50 opacity-70"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex flex-col gap-1 pt-6">
                      <form action={moveTaskUpAction}>
                        <input type="hidden" name="id" value={t.id} />
                        <button
                          type="submit"
                          disabled={isFirst}
                          aria-label="Move up"
                          className="grid place-items-center size-7 rounded-lg ring-1 ring-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          ▲
                        </button>
                      </form>
                      <form action={moveTaskDownAction}>
                        <input type="hidden" name="id" value={t.id} />
                        <button
                          type="submit"
                          disabled={isLast}
                          aria-label="Move down"
                          className="grid place-items-center size-7 rounded-lg ring-1 ring-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          ▼
                        </button>
                      </form>
                    </div>

                    <form
                      action={updateTaskAction}
                      className="flex-1 grid gap-2 sm:grid-cols-[1fr_5rem_auto] sm:items-end"
                    >
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="recurring" value="on" />
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
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <input
                          type="checkbox"
                          name="active"
                          defaultChecked={t.active}
                        />
                        Active
                      </label>
                      <div className="sm:col-span-3 flex gap-2">
                        <button type="submit" className="btn-secondary">
                          Save
                        </button>
                      </div>
                    </form>
                  </div>
                  <form action={deleteTaskAction} className="mt-2">
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
