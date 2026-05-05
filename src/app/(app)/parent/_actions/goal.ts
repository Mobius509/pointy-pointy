"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireParent } from "@/lib/auth/pin";

export async function updateGoalAction(formData: FormData) {
  await requireParent();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing goal id.");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name required.");
  const target = Number(formData.get("target_points"));
  if (!Number.isFinite(target) || target <= 0 || target > 1_000_000) {
    throw new Error("Target must be a positive number.");
  }

  const { error } = await supabaseAdmin
    .from("goals")
    .update({ name, target_points: Math.round(target) })
    .eq("id", id);
  if (error) throw error;

  revalidatePath("/parent");
  revalidatePath("/parent/goal");
  revalidatePath("/");
}

export async function redeemGoalAction(formData: FormData) {
  await requireParent();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing goal id.");

  const { error } = await supabaseAdmin
    .from("goals")
    .update({ redeemed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;

  revalidatePath("/parent");
  revalidatePath("/parent/goal");
  revalidatePath("/");
}

export async function startNewGoalAction(formData: FormData) {
  await requireParent();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name required.");
  const target = Number(formData.get("target_points"));
  if (!Number.isFinite(target) || target <= 0 || target > 1_000_000) {
    throw new Error("Target must be a positive number.");
  }

  // Ensure any existing active goal is redeemed first so the new one is the only active.
  const { error: closeErr } = await supabaseAdmin
    .from("goals")
    .update({ redeemed_at: new Date().toISOString() })
    .is("redeemed_at", null);
  if (closeErr) throw closeErr;

  const { error } = await supabaseAdmin.from("goals").insert({
    name,
    target_points: Math.round(target),
  });
  if (error) throw error;

  revalidatePath("/parent");
  revalidatePath("/parent/goal");
  revalidatePath("/");
}
