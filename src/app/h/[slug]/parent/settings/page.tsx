import { PushToggle } from "@/app/_components/PushToggle";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { requireHouseholdAccess } from "@/lib/v2/auth";
import { getKidProfiles } from "@/lib/v2/data";
import { getHighScores } from "@/lib/v2/high-scores";
import { getHouseholdMembers, getPendingInvites } from "@/lib/v2/members";
import { updateHouseholdSettingsAction } from "../_actions/settings";
import { CelebrationGallery } from "../_components/CelebrationGallery";
import { CoParentManager } from "../_components/CoParentManager";
import { KidRemindersCard } from "../_components/KidRemindersCard";
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
  const { data: reminderRows } = await supabaseV2Admin
    .from("kid_profiles")
    .select("id, reminder_time")
    .eq("household_id", household.id);
  const reminderByKid = new Map(
    (reminderRows ?? []).map((r) => [
      r.id as string,
      r.reminder_time ? (r.reminder_time as string).slice(0, 5) : null,
    ]),
  );

  return (
    <div className="space-y-6 text-[14px]">
      <PageTitle>Settings</PageTitle>

      <KidUrlCard slug={slug} />

      <section className="card">
        <SectionPill>Notifications</SectionPill>
        <p className="text-pp-muted mt-2">
          Get notified on this device when a kid finishes a task or asks for
          bonus points. On iPhone, add Pointy Points to your home screen first.
        </p>
        <div className="mt-4">
          <PushToggle slug={slug} role="parent" label="Turn on notifications" />
        </div>
      </section>

      <KidRemindersCard
        slug={slug}
        kids={kids.map((k) => ({
          id: k.id,
          name: k.name,
          avatar_emoji: k.avatar_emoji,
          reminderTime: reminderByKid.get(k.id) ?? null,
        }))}
      />

      <CelebrationGallery
        kids={kids.map((k) => ({ id: k.id, name: k.name, avatar_emoji: k.avatar_emoji }))}
        highScores={await getHighScores(household.id)}
      />

      <KidsAdmin slug={slug} kids={kids} />

      <CoParentManager slug={slug} members={members} invites={invites} />

      <section className="card">
        <SectionPill>Family settings</SectionPill>
        <p className="text-pp-muted mt-2">
          The daily checklist resets at midnight in this timezone.
        </p>
        <form
          action={updateHouseholdSettingsAction}
          className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
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
          <button type="submit" className="btn-soft">
            Save
          </button>
        </form>
      </section>
    </div>
  );
}
