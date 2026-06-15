import { getSettings } from "@/lib/data";
import { PushToggle } from "@/app/_components/PushToggle";
import {
  updateKidNameAction,
  updateTimezoneAction,
} from "../_actions/settings";
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
        <h2 className="text-lg font-bold text-slate-800">Notifications</h2>
        <p className="text-sm text-slate-600 mt-1 mb-3">
          Get a push when your kid submits a task or suggests a bonus.
        </p>
        <PushToggle role="parent" label="Tell me when a kid submits" />
      </section>

      <section className="card">
        <h2 className="text-lg font-bold text-slate-800">Change PIN</h2>
        <p className="text-sm text-slate-600 mt-1 mb-3">
          The PIN protects parent admin actions on shared devices.
        </p>
        <ChangePinForm />
      </section>

      <section className="card">
        <h2 className="text-lg font-bold text-slate-800">Kid&apos;s name</h2>
        <p className="text-sm text-slate-600 mt-1">
          Shown in push notifications so you know who submitted what.
        </p>
        <form
          action={updateKidNameAction}
          className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
        >
          <div>
            <label className="label" htmlFor="kid-name">
              Name
            </label>
            <input
              id="kid-name"
              name="kid_name"
              defaultValue={settings.kid_name ?? ""}
              required
              maxLength={60}
              className="input"
              placeholder="Freya"
            />
          </div>
          <button type="submit" className="btn-primary">
            Save
          </button>
        </form>
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
