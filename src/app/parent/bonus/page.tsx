import { getActiveBonusTemplates } from "@/lib/data";
import {
  awardBonusFromTemplateAction,
  awardCustomBonusAction,
} from "../_actions/bonus";

export const dynamic = "force-dynamic";

export default async function BonusPage() {
  const templates = await getActiveBonusTemplates();

  return (
    <div className="space-y-4">
      <section className="card">
        <h2 className="text-lg font-bold text-slate-800">Award a bonus</h2>
        <p className="text-sm text-slate-600 mt-1">
          Pick from a saved bonus template, or award a one-off below.
        </p>

        {templates.length === 0 ? (
          <p className="text-sm text-slate-500 italic mt-3">
            No bonus templates yet — create one on the Tasks tab (uncheck
            &quot;daily checklist&quot;).
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {templates.map((t) => (
              <li
                key={t.id}
                className="rounded-xl ring-1 ring-slate-200 bg-white p-3"
              >
                <form
                  action={awardBonusFromTemplateAction}
                  className="flex flex-wrap items-center gap-3"
                >
                  <input type="hidden" name="task_id" value={t.id} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{t.name}</div>
                    {t.description && (
                      <div className="text-xs text-slate-500">
                        {t.description}
                      </div>
                    )}
                  </div>
                  <span className="rounded-full bg-brand-100 text-brand-700 px-3 py-1 text-sm font-bold tabular-nums">
                    +{t.points}
                  </span>
                  <input
                    name="note"
                    placeholder="Note (optional)"
                    className="input flex-1 min-w-[12rem]"
                  />
                  <button type="submit" className="btn-primary">
                    Award
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h3 className="text-lg font-bold text-slate-800">One-off bonus</h3>
        <form
          action={awardCustomBonusAction}
          className="mt-3 grid gap-3 sm:grid-cols-[1fr_6rem_auto]"
        >
          <div>
            <label className="label" htmlFor="custom-name">
              What was it?
            </label>
            <input
              id="custom-name"
              name="name"
              required
              className="input"
              placeholder="Helped vacuum"
            />
          </div>
          <div>
            <label className="label" htmlFor="custom-points">
              Points
            </label>
            <input
              id="custom-points"
              name="points"
              type="number"
              min={0}
              max={1000}
              defaultValue={5}
              required
              className="input"
            />
          </div>
          <div className="self-end">
            <button type="submit" className="btn-primary">
              Award
            </button>
          </div>
          <div className="sm:col-span-3">
            <label className="label" htmlFor="custom-note">
              Note (optional)
            </label>
            <input id="custom-note" name="note" className="input" />
          </div>
        </form>
      </section>
    </div>
  );
}
