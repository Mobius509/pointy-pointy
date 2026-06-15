"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireParent, setPin } from "@/lib/auth/pin";

export async function changePinAction(formData: FormData): Promise<
  { ok: true } | { ok: false; error: string }
> {
  await requireParent();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next !== confirm) return { ok: false, error: "New PINs don't match." };

  const { data, error } = await supabaseAdmin
    .from("settings")
    .select("parent_pin_hash")
    .eq("id", 1)
    .single();
  if (error) return { ok: false, error: error.message };
  const ok = data?.parent_pin_hash
    ? await bcrypt.compare(current, data.parent_pin_hash)
    : false;
  if (!ok) return { ok: false, error: "Current PIN is wrong." };

  try {
    await setPin(next);
    revalidatePath("/v1/parent/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function updateTimezoneAction(formData: FormData) {
  await requireParent();
  const tz = String(formData.get("timezone") ?? "").trim();
  if (!tz) throw new Error("Timezone required.");
  // Validate by trying to format with it.
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
  } catch {
    throw new Error(`Unknown timezone "${tz}".`);
  }

  const { error } = await supabaseAdmin
    .from("settings")
    .update({ timezone: tz })
    .eq("id", 1);
  if (error) throw error;

  revalidatePath("/v1/parent/settings");
  revalidatePath("/v1");
}

export async function updateKidNameAction(formData: FormData) {
  await requireParent();
  const name = String(formData.get("kid_name") ?? "").trim();
  if (!name) throw new Error("Kid name required.");
  if (name.length > 60) throw new Error("Keep it under 60 characters.");

  const { error } = await supabaseAdmin
    .from("settings")
    .update({ kid_name: name })
    .eq("id", 1);
  if (error) throw error;

  revalidatePath("/v1/parent/settings");
}
