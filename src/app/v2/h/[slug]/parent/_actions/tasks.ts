"use server";

import { revalidatePath } from "next/cache";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { requireHouseholdAccess } from "@/lib/v2/auth";
import type { Frequency } from "@/lib/time";

const FREQUENCIES: ReadonlySet<Frequency> = new Set([
  "daily",
  "weekly",
  "biweekly",
  "monthly",
  "yearly",
]);

function parseFrequency(raw: FormDataEntryValue | null): Frequency {
  const v = String(raw ?? "daily");
  if (FREQUENCIES.has(v as Frequency)) return v as Frequency;
  throw new Error(`Invalid frequency "${v}".`);
}

function parsePoints(raw: FormDataEntryValue | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1000) {
    throw new Error("Points must be a whole number between 0 and 1000.");
  }
  return Math.round(n);
}

async function nextSortOrder(householdId: string): Promise<number> {
  const { data } = await supabaseV2Admin
    .from("tasks")
    .select("sort_order")
    .eq("household_id", householdId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.sort_order ?? 0) + 10;
}

export async function createTaskAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const household = await requireHouseholdAccess(slug);

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name required.");
  const description = String(formData.get("description") ?? "").trim() || null;
  const points = parsePoints(formData.get("points"));
  const frequency = parseFrequency(formData.get("frequency"));
  const sort_order = await nextSortOrder(household.id);

  const { error } = await supabaseV2Admin.from("tasks").insert({
    household_id: household.id,
    name,
    description,
    points,
    recurring: true,
    sort_order,
    frequency,
  });
  if (error) throw error;

  revalidatePath(`/v2/h/${slug}/parent/tasks`);
  revalidatePath(`/v2/h/${slug}`);
}

export async function updateTaskAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const household = await requireHouseholdAccess(slug);

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing task id.");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name required.");
  const description = String(formData.get("description") ?? "").trim() || null;
  const points = parsePoints(formData.get("points"));
  const frequency = parseFrequency(formData.get("frequency"));
  const active = formData.get("active") === "on";

  const { error } = await supabaseV2Admin
    .from("tasks")
    .update({ name, description, points, active, frequency })
    .eq("id", id)
    .eq("household_id", household.id);
  if (error) throw error;

  revalidatePath(`/v2/h/${slug}/parent/tasks`);
  revalidatePath(`/v2/h/${slug}`);
}

export async function deleteTaskAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const household = await requireHouseholdAccess(slug);

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing task id.");

  const { error } = await supabaseV2Admin
    .from("tasks")
    .delete()
    .eq("id", id)
    .eq("household_id", household.id);
  if (error) throw error;

  revalidatePath(`/v2/h/${slug}/parent/tasks`);
  revalidatePath(`/v2/h/${slug}`);
}

async function swapSortOrders(
  householdId: string,
  idA: string,
  idB: string,
) {
  const { data, error } = await supabaseV2Admin
    .from("tasks")
    .select("id, sort_order")
    .in("id", [idA, idB])
    .eq("household_id", householdId);
  if (error) throw error;
  const a = data?.find((r) => r.id === idA);
  const b = data?.find((r) => r.id === idB);
  if (!a || !b) throw new Error("Task not found.");

  const { error: e1 } = await supabaseV2Admin
    .from("tasks")
    .update({ sort_order: b.sort_order })
    .eq("id", a.id)
    .eq("household_id", householdId);
  if (e1) throw e1;
  const { error: e2 } = await supabaseV2Admin
    .from("tasks")
    .update({ sort_order: a.sort_order })
    .eq("id", b.id)
    .eq("household_id", householdId);
  if (e2) throw e2;
}

export async function moveTaskUpAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const household = await requireHouseholdAccess(slug);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing task id.");

  const { data: cur, error } = await supabaseV2Admin
    .from("tasks")
    .select("id, sort_order")
    .eq("id", id)
    .eq("household_id", household.id)
    .single();
  if (error || !cur) throw new Error("Task not found.");

  const { data: prev } = await supabaseV2Admin
    .from("tasks")
    .select("id, sort_order")
    .eq("household_id", household.id)
    .lt("sort_order", cur.sort_order)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!prev) return;

  await swapSortOrders(household.id, cur.id, prev.id);
  revalidatePath(`/v2/h/${slug}/parent/tasks`);
  revalidatePath(`/v2/h/${slug}`);
}

export async function moveTaskDownAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const household = await requireHouseholdAccess(slug);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing task id.");

  const { data: cur, error } = await supabaseV2Admin
    .from("tasks")
    .select("id, sort_order")
    .eq("id", id)
    .eq("household_id", household.id)
    .single();
  if (error || !cur) throw new Error("Task not found.");

  const { data: next } = await supabaseV2Admin
    .from("tasks")
    .select("id, sort_order")
    .eq("household_id", household.id)
    .gt("sort_order", cur.sort_order)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!next) return;

  await swapSortOrders(household.id, cur.id, next.id);
  revalidatePath(`/v2/h/${slug}/parent/tasks`);
  revalidatePath(`/v2/h/${slug}`);
}
