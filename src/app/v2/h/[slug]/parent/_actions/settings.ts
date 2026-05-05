"use server";

import { revalidatePath } from "next/cache";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { requireHouseholdAccess } from "@/lib/v2/auth";

export async function updateHouseholdSettingsAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const household = await requireHouseholdAccess(slug);

  const tz = String(formData.get("timezone") ?? "").trim();
  if (!tz) throw new Error("Timezone required.");
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
  } catch {
    throw new Error(`Unknown timezone "${tz}".`);
  }

  const newName = String(formData.get("name") ?? "").trim();
  const update: { timezone: string; name?: string } = { timezone: tz };
  if (newName) update.name = newName;

  const { error } = await supabaseV2Admin
    .from("households")
    .update(update)
    .eq("id", household.id);
  if (error) throw error;

  revalidatePath(`/v2/h/${slug}/parent/settings`);
  revalidatePath(`/v2/h/${slug}/parent`);
  revalidatePath(`/v2/h/${slug}`);
}
