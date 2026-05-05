import { requireHouseholdAccess } from "@/lib/v2/auth";
import { getKidProfiles } from "@/lib/v2/data";
import { getHouseholdMembers, getPendingInvites } from "@/lib/v2/members";
import { updateHouseholdSettingsAction } from "../_actions/settings";
import { CoParentManager } from "../_components/CoParentManager";
import { KidsAdmin } from "../_components/KidsAdmin";

export const dynamic = "force-dynamic";

const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "America/Honolulu",
  "America/Phoenix",
  "America/Toronto",
  "Europe/London",
  "Europe/Paris",
  "UTC",
];

export default async function ParentSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const household = await requireHouseholdAccess(slug);
  const members = await getHouseholdMembers(household.id);
  const invites = await getPendingInvites(household.id);
  const kids = await getKidProfiles(household.id);

  return (
    <div className="space-y-4">
      <KidsAdmin slug={slug} kids={kids} />

      <CoParentManager slug={slug} members={members} invites={invites} />

      <section className="card">
        <h2 className="text-lg font-bold text-slate-800">Family settings</h2>
        <p className="text-sm text-slate-600 mt-1">
          The daily checklist resets at midnight in this timezone.
        </p>
        <form
          action={updateHouseholdSettingsAction}
          className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <input type="hidden" name="slug" value={slug} />
          <div>
            <label className="label" htmlFor="settings-name">
              Family name
            </label>
            <input
              id="settings-name"
              name="name"
              defaultValue={household.name}
              maxLength={80}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="settings-tz">
              Timezone (IANA)
            </label>
            <input
              id="settings-tz"
              name="timezone"
              defaultValue={household.timezone}
              required
              list="settings-tz-options"
              className="input"
            />
            <datalist id="settings-tz-options">
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz} />
              ))}
            </datalist>
          </div>
          <button type="submit" className="btn-primary">
            Save
          </button>
        </form>
      </section>
    </div>
  );
}
