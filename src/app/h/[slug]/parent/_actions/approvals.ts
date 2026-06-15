"use server";

import { revalidatePath } from "next/cache";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { requireHouseholdAccess } from "@/lib/v2/auth";

export async function approveCompletionAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const household = await requireHouseholdAccess(slug);

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id.");

  const update: { status: "approved"; points_snapshot?: number } = {
    status: "approved",
  };
  const pointsRaw = formData.get("points");
  if (pointsRaw !== null && pointsRaw !== "") {
    const n = Number(pointsRaw);
    if (!Number.isFinite(n) || n < 0 || n > 1000) {
      throw new Error("Points must be between 0 and 1000.");
    }
    update.points_snapshot = Math.round(n);
  }

  const { error } = await supabaseV2Admin
    .from("completions")
    .update(update)
    .eq("id", id)
    .eq("household_id", household.id);
  if (error) throw error;

  revalidatePath(`/h/${slug}/parent`);
  revalidatePath(`/h/${slug}/parent/activity`);
  revalidatePath(`/h/${slug}`);
}

export async function denyCompletionAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const household = await requireHouseholdAccess(slug);

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id.");

  const { error } = await supabaseV2Admin
    .from("completions")
    .delete()
    .eq("id", id)
    .eq("household_id", household.id);
  if (error) throw error;

  revalidatePath(`/h/${slug}/parent`);
  revalidatePath(`/h/${slug}/parent/activity`);
  revalidatePath(`/h/${slug}`);
}

export async function deleteCompletionAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const household = await requireHouseholdAccess(slug);

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id.");
  const { error } = await supabaseV2Admin
    .from("completions")
    .delete()
    .eq("id", id)
    .eq("household_id", household.id);
  if (error) throw error;

  revalidatePath(`/h/${slug}/parent`);
  revalidatePath(`/h/${slug}/parent/activity`);
  revalidatePath(`/h/${slug}`);
}
