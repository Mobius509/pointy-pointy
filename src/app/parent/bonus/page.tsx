import { awardCustomBonusAction } from "../_actions/bonus";

export const dynamic = "force-dynamic";

export default function BonusPage() {
  return (
    <div className="space-y-4">
      <section className="card">
        <h2 className="text-lg font-bold text-slate-800">Award a bonus</h2>
        <p className="text-sm text-slate-600 mt-1">
          For one-off things she did that aren&apos;t on her daily list.
        </p>
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
