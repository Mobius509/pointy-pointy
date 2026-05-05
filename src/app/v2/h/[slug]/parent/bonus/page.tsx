import { requireHouseholdAccess } from "@/lib/v2/auth";
import { getKidProfiles } from "@/lib/v2/data";
import { awardCustomBonusAction } from "../_actions/bonus";

export const dynamic = "force-dynamic";

export default async function ParentBonusPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const household = await requireHouseholdAccess(slug);
  const kids = await getKidProfiles(household.id);

  if (kids.length === 0) {
    return (
      <section className="card">
        <h2 className="text-lg font-bold text-slate-800">Award a bonus</h2>
        <p className="text-sm text-slate-600 mt-1">
          Add at least one kid first under the Kids tab.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="card">
        <h2 className="text-lg font-bold text-slate-800">Award a bonus</h2>
        <p className="text-sm text-slate-600 mt-1">
          For one-off things they did that aren&apos;t on the daily list.
        </p>
        <form
          action={awardCustomBonusAction}
          className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_6rem_auto] sm:items-end"
        >
          <input type="hidden" name="slug" value={slug} />
          <div>
            <label className="label" htmlFor="bonus-kid">
              Kid
            </label>
            <select
              id="bonus-kid"
              name="kid_profile_id"
              required
              defaultValue={kids[0].id}
              className="input"
            >
              {kids.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.avatar_emoji} {k.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="bonus-name">
              What was it?
            </label>
            <input
              id="bonus-name"
              name="name"
              required
              className="input"
              placeholder="Helped vacuum"
            />
          </div>
          <div>
            <label className="label" htmlFor="bonus-points">
              Points
            </label>
            <input
              id="bonus-points"
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
            <button type="submit" className="btn-primary">
              Award
            </button>
          </div>
          <div className="sm:col-span-4">
            <label className="label" htmlFor="bonus-note">
              Note (optional)
            </label>
            <input id="bonus-note" name="note" className="input" />
          </div>
        </form>
      </section>
    </div>
  );
}
