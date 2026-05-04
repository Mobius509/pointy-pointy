import { getSettings } from "@/lib/data";
import { updateTimezoneAction } from "../_actions/settings";
import { ChangePinForm } from "./_form";

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

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <div className="space-y-4">
      <section className="card">
        <h2 className="text-lg font-bold text-slate-800">Change PIN</h2>
        <p className="text-sm text-slate-600 mt-1 mb-3">
          The PIN protects parent admin actions on shared devices.
        </p>
        <ChangePinForm />
      </section>

      <section className="card">
        <h2 className="text-lg font-bold text-slate-800">Timezone</h2>
        <p className="text-sm text-slate-600 mt-1">
          Daily checklist resets at midnight in this timezone.
        </p>
        <form
          action={updateTimezoneAction}
          className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
        >
          <div>
            <label className="label" htmlFor="tz">
              Timezone (IANA)
            </label>
            <input
              id="tz"
              name="timezone"
              defaultValue={settings.timezone}
              required
              list="tz-options"
              className="input"
            />
            <datalist id="tz-options">
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
