"use server";

import { revalidatePath } from "next/cache";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { hashPin, requireHouseholdAccess } from "@/lib/v2/auth";
import { AVATAR_IDS, DEFAULT_AVATAR, avatarId } from "@/lib/avatar";

// Validates the avatar value from a form. Accepts new-style ids
// ("monster1") or legacy emoji ("🐶") — the latter gets normalized to its
// matching id. Anything else falls back to DEFAULT_AVATAR.
function readAvatar(formData: FormData): string {
  const raw = String(formData.get("avatar_emoji") ?? "").trim();
  if (!raw) return DEFAULT_AVATAR;
  if ((AVATAR_IDS as readonly string[]).includes(raw)) return raw;
  return avatarId(raw); // maps legacy emoji → id, else default
}

export async function createKidAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const household = await requireHouseholdAccess(slug);

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name required.");
  const avatar = readAvatar(formData);
  const pin = String(formData.get("pin") ?? "");
  const confirmPin = String(formData.get("confirm_pin") ?? "");
  if (pin !== confirmPin) throw new Error("PINs don't match.");
  const pin_hash = await hashPin(pin);

  // New kids go to the bottom of the picker.
  const { data: max } = await supabaseV2Admin
    .from("kid_profiles")
    .select("sort_order")
    .eq("household_id", household.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort_order = (max?.sort_order ?? 0) + 10;

  const { error } = await supabaseV2Admin.from("kid_profiles").insert({
    household_id: household.id,
    name,
    avatar_emoji: avatar,
    pin_hash,
    sort_order,
  });
  if (error) throw error;

  revalidatePath(`/v2/h/${slug}/parent/kids`);
  revalidatePath(`/v2/h/${slug}/parent`);
  revalidatePath(`/v2/h/${slug}`);
}

export async function updateKidAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const household = await requireHouseholdAccess(slug);

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing kid id.");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name required.");
  const avatar = readAvatar(formData);

  const { error } = await supabaseV2Admin
    .from("kid_profiles")
    .update({ name, avatar_emoji: avatar })
    .eq("id", id)
    .eq("household_id", household.id);
  if (error) throw error;

  revalidatePath(`/v2/h/${slug}/parent/kids`);
  revalidatePath(`/v2/h/${slug}/parent`);
  revalidatePath(`/v2/h/${slug}`);
}

export async function resetKidPinAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const household = await requireHouseholdAccess(slug);

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing kid id.");
  const pin = String(formData.get("pin") ?? "");
  const confirmPin = String(formData.get("confirm_pin") ?? "");
  if (pin !== confirmPin) throw new Error("PINs don't match.");
  const pin_hash = await hashPin(pin);

  const { error } = await supabaseV2Admin
    .from("kid_profiles")
    .update({ pin_hash })
    .eq("id", id)
    .eq("household_id", household.id);
  if (error) throw error;

  revalidatePath(`/v2/h/${slug}/parent/kids`);
}

export async function deleteKidAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const household = await requireHouseholdAccess(slug);

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing kid id.");

  // Delete the profile. completions/goals reference kid_profiles with
  // ON DELETE CASCADE, so the kid's history is removed too.
  const { error } = await supabaseV2Admin
    .from("kid_profiles")
    .delete()
    .eq("id", id)
    .eq("household_id", household.id);
  if (error) throw error;

  revalidatePath(`/v2/h/${slug}/parent/kids`);
  revalidatePath(`/v2/h/${slug}/parent`);
  revalidatePath(`/v2/h/${slug}`);
}
