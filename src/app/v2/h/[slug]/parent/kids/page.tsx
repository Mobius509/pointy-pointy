import { requireHouseholdAccess } from "@/lib/v2/auth";
import { getKidProfiles } from "@/lib/v2/data";
import {
  createKidAction,
  deleteKidAction,
  resetKidPinAction,
  updateKidAction,
} from "../_actions/kids";

export const dynamic = "force-dynamic";

const AVATARS = ["🐶", "🐱", "🦊", "🐻", "🦄", "🐯", "🐸", "🐵", "🦖", "🐧"];

export default async function KidsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const household = await requireHouseholdAccess(slug);
  const kids = await getKidProfiles(household.id);

  return (
    <div className="space-y-4">
      <section className="card">
        <h2 className="text-lg font-bold text-slate-800">Add a kid</h2>
        <p className="text-sm text-slate-600 mt-1">
          Each kid gets their own PIN to unlock their checklist.
        </p>
        <form
          action={createKidAction}
          className="mt-3 grid gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="slug" value={slug} />
          <div>
            <label className="label" htmlFor="kid-new-name">
              Name
            </label>
            <input
              id="kid-new-name"
              name="name"
              required
              maxLength={40}
              className="input"
              placeholder="Sam"
            />
          </div>
          <div>
            <label className="label" htmlFor="kid-new-avatar">
              Avatar
            </label>
            <select
              id="kid-new-avatar"
              name="avatar_emoji"
              defaultValue="🐶"
              className="input"
            >
              {AVATARS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="kid-new-pin">
              PIN (4–8 digits)
            </label>
            <input
              id="kid-new-pin"
              name="pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              minLength={4}
              maxLength={8}
              required
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="kid-new-pin2">
              Confirm PIN
            </label>
            <input
              id="kid-new-pin2"
              name="confirm_pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              minLength={4}
              maxLength={8}
              required
              className="input"
            />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary">
              Add kid
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <h2 className="text-lg font-bold text-slate-800 mb-3">Your kids</h2>
        {kids.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No kids yet.</p>
        ) : (
          <ul className="space-y-3">
            {kids.map((k) => (
              <li
                key={k.id}
                className="rounded-xl ring-1 ring-slate-200 bg-white p-3"
              >
                <form
                  action={updateKidAction}
                  className="grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-end"
                >
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={k.id} />
                  <div>
                    <label className="label">Avatar</label>
                    <select
                      name="avatar_emoji"
                      defaultValue={k.avatar_emoji}
                      className="input"
                    >
                      {AVATARS.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Name</label>
                    <input
                      name="name"
                      defaultValue={k.name}
                      required
                      maxLength={40}
                      className="input"
                    />
                  </div>
                  <button type="submit" className="btn-secondary">
                    Save
                  </button>
                </form>

                <details className="mt-3">
                  <summary className="text-sm font-semibold text-slate-700 cursor-pointer">
                    Reset PIN
                  </summary>
                  <form
                    action={resetKidPinAction}
                    className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                  >
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="id" value={k.id} />
                    <div>
                      <label className="label">New PIN</label>
                      <input
                        name="pin"
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        minLength={4}
                        maxLength={8}
                        required
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label">Confirm</label>
                      <input
                        name="confirm_pin"
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        minLength={4}
                        maxLength={8}
                        required
                        className="input"
                      />
                    </div>
                    <button type="submit" className="btn-secondary">
                      Reset
                    </button>
                  </form>
                </details>

                <form action={deleteKidAction} className="mt-3">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={k.id} />
                  <button
                    type="submit"
                    className="text-xs text-rose-600 hover:underline"
                  >
                    Delete kid (also removes their history)
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
