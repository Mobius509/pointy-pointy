import { requireHouseholdAccess } from "@/lib/v2/auth";
import { getKidProfiles } from "@/lib/v2/data";
import { getHouseholdMembers, getPendingInvites } from "@/lib/v2/members";
import { updateHouseholdSettingsAction } from "../_actions/settings";
import { CoParentManager } from "../_components/CoParentManager";
import { KidsAdmin } from "../_components/KidsAdmin";
import { KidUrlCard } from "../_components/KidUrlCard";
import { PageTitle, SectionPill } from "../_components/ui";

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
    <div className="space-y-6 text-[14px]">
      <PageTitle>Settings</PageTitle>

      <KidUrlCard slug={slug} />

      <KidsAdmin slug={slug} kids={kids} />

      <CoParentManager slug={slug} members={members} invites={invites} />

      <section className="card-warm">
        <SectionPill>Family settings</SectionPill>
        <p className="text-[#C3A38A] mt-2">
          The daily checklist resets at midnight in this timezone.
        </p>
        <form
          action={updateHouseholdSettingsAction}
          className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <input type="hidden" name="slug" value={slug} />
          <div>
            <label className="label-warm" htmlFor="settings-name">
              Family name
            </label>
            <input
              id="settings-name"
              name="name"
              defaultValue={household.name}
              maxLength={80}
              className="input-warm"
            />
          </div>
          <div>
            <label className="label-warm" htmlFor="settings-tz">
              Timezone (IANA)
            </label>
            <input
              id="settings-tz"
              name="timezone"
              defaultValue={household.timezone}
              required
              list="settings-tz-options"
              className="input-warm"
            />
            <datalist id="settings-tz-options">
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz} />
              ))}
            </datalist>
          </div>
          <button type="submit" className="btn-warm-primary">
            Save
          </button>
        </form>
      </section>
    </div>
  );
}
