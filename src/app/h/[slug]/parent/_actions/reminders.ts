"use server";

import { revalidatePath } from "next/cache";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { requireHouseholdAccess } from "@/lib/v2/auth";
import { setKidReminderTime } from "@/lib/v2/kid-ops";
import { sendReminder } from "@/lib/v2/push/reminders";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

// Parent sets (or clears, with null) a kid's daily reminder time.
export async function setKidReminderByParentAction(
  slug: string,
  kidProfileId: string,
  time: string | null,
): Promise<Result> {
  const household = await requireHouseholdAccess(slug);
  const res = await setKidReminderTime(
    { householdId: household.id, kidProfileId, timezone: household.timezone },
    time,
  );
  if (res.ok) {
    revalidatePath(`/h/${slug}/parent/settings`);
    revalidatePath(`/h/${slug}/settings`);
  }
  return res;
}

// Sends the kid's reminder immediately, through the same path the
// scheduled job uses. Reports how many devices got it so the parent can
// tell "notifications not turned on" apart from a delivery problem.
export async function sendTestReminderAction(
  slug: string,
  kidProfileId: string,
): Promise<Result<{ devices: number; delivered: number }>> {
  const household = await requireHouseholdAccess(slug);

  const { count, error } = await supabaseV2Admin
    .from("push_devices")
    .select("id", { count: "exact", head: true })
    .eq("household_id", household.id)
    .eq("kid_profile_id", kidProfileId);
  if (error) return { ok: false, error: error.message };

  const { delivered } = await sendReminder(
    { householdId: household.id, kidProfileId, timezone: household.timezone },
    { skipIfCaughtUp: false, test: true },
  );
  return { ok: true, devices: count ?? 0, delivered };
}
