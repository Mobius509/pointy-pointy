"use server";

import { revalidatePath } from "next/cache";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { requireHouseholdAccess } from "@/lib/v2/auth";

function parseTarget(raw: FormDataEntryValue | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) {
    throw new Error("Target must be a positive number.");
  }
  return Math.round(n);
}

export async function startNewGoalAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const household = await requireHouseholdAccess(slug);

  const kidProfileId = String(formData.get("kid_profile_id") ?? "");
  if (!kidProfileId) throw new Error("Pick a kid.");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name required.");
  const target = parseTarget(formData.get("target_points"));

  // Close any existing active goal for this kid first so there's only one.
  const { error: closeErr } = await supabaseV2Admin
    .from("goals")
    .update({ redeemed_at: new Date().toISOString() })
    .eq("household_id", household.id)
    .eq("kid_profile_id", kidProfileId)
    .is("redeemed_at", null);
  if (closeErr) throw closeErr;

  const { error } = await supabaseV2Admin.from("goals").insert({
    household_id: household.id,
    kid_profile_id: kidProfileId,
    name,
    target_points: target,
  });
  if (error) throw error;

  revalidatePath(`/h/${slug}/parent/goal`);
  revalidatePath(`/h/${slug}/parent`);
  revalidatePath(`/h/${slug}`);
}

export async function updateGoalAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const household = await requireHouseholdAccess(slug);

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing goal id.");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name required.");
  const target = parseTarget(formData.get("target_points"));

  const { error } = await supabaseV2Admin
    .from("goals")
    .update({ name, target_points: target })
    .eq("id", id)
    .eq("household_id", household.id);
  if (error) throw error;

  revalidatePath(`/h/${slug}/parent/goal`);
  revalidatePath(`/h/${slug}`);
}

export async function redeemGoalAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const household = await requireHouseholdAccess(slug);

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing goal id.");

  const { error } = await supabaseV2Admin
    .from("goals")
    .update({ redeemed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("household_id", household.id);
  if (error) throw error;

  revalidatePath(`/h/${slug}/parent/goal`);
  revalidatePath(`/h/${slug}`);
}
