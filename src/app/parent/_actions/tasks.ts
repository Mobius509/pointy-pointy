"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireParent } from "@/lib/auth/pin";

function parsePoints(raw: FormDataEntryValue | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1000) {
    throw new Error("Points must be a whole number between 0 and 1000.");
  }
  return Math.round(n);
}

export async function createTaskAction(formData: FormData) {
  await requireParent();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name required.");
  const description = String(formData.get("description") ?? "").trim() || null;
  const points = parsePoints(formData.get("points"));
  const recurring = formData.get("recurring") === "on";
  const sort_order = Number(formData.get("sort_order") ?? 0) || 0;

  const { error } = await supabaseAdmin.from("tasks").insert({
    name,
    description,
    points,
    recurring,
    sort_order,
  });
  if (error) throw error;

  revalidatePath("/parent/tasks");
  revalidatePath("/");
}

export async function updateTaskAction(formData: FormData) {
  await requireParent();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing task id.");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name required.");
  const description = String(formData.get("description") ?? "").trim() || null;
  const points = parsePoints(formData.get("points"));
  const recurring = formData.get("recurring") === "on";
  const active = formData.get("active") === "on";
  const sort_order = Number(formData.get("sort_order") ?? 0) || 0;

  const { error } = await supabaseAdmin
    .from("tasks")
    .update({ name, description, points, recurring, active, sort_order })
    .eq("id", id);
  if (error) throw error;

  revalidatePath("/parent/tasks");
  revalidatePath("/");
}

export async function deleteTaskAction(formData: FormData) {
  await requireParent();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing task id.");

  // Soft-delete: just deactivate. Keeps history references valid.
  const { error } = await supabaseAdmin
    .from("tasks")
    .update({ active: false })
    .eq("id", id);
  if (error) throw error;

  revalidatePath("/parent/tasks");
  revalidatePath("/");
}
