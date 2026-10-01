import "server-only";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { todayInTimezone } from "@/lib/time";

// Adds approved bonus points for a kid (a parent's custom bonus, a streak
// reward…). Counts toward their goal like any approved completion and shows
// in their next celebration. Returns the new completion's id.
export async function insertBonusCompletion(opts: {
  householdId: string;
  kidProfileId: string;
  timezone: string;
  name: string;
  points: number;
  note?: string | null;
}): Promise<string> {
  const today = todayInTimezone(opts.timezone);
  const { data, error } = await supabaseV2Admin
    .from("completions")
    .insert({
      household_id: opts.householdId,
      kid_profile_id: opts.kidProfileId,
      task_id: null,
      task_name_snapshot: opts.name,
      points_snapshot: Math.round(opts.points),
      completed_on: today,
      is_bonus: true,
      status: "approved",
      note: opts.note ?? null,
      period_key: `D-${today}`,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}
