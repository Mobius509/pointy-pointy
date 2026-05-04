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

async function nextSortOrder(): Promise<number> {
  const { data } = await supabaseAdmin
    .from("tasks")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.sort_order ?? 0) + 10;
}

export async function createTaskAction(formData: FormData) {
  await requireParent();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name required.");
  const description = String(formData.get("description") ?? "").trim() || null;
  const points = parsePoints(formData.get("points"));
  const recurring = formData.get("recurring") === "on";
  const sort_order = await nextSortOrder();

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

  const { error } = await supabaseAdmin
    .from("tasks")
    .update({ name, description, points, recurring, active })
    .eq("id", id);
  if (error) throw error;

  revalidatePath("/parent/tasks");
  revalidatePath("/");
}

async function swapSortOrders(idA: string, idB: string) {
  const { data, error: readErr } = await supabaseAdmin
    .from("tasks")
    .select("id, sort_order")
    .in("id", [idA, idB]);
  if (readErr) throw readErr;
  const a = data?.find((r) => r.id === idA);
  const b = data?.find((r) => r.id === idB);
  if (!a || !b) throw new Error("Task not found.");

  const { error: e1 } = await supabaseAdmin
    .from("tasks")
    .update({ sort_order: b.sort_order })
    .eq("id", a.id);
  if (e1) throw e1;
  const { error: e2 } = await supabaseAdmin
    .from("tasks")
    .update({ sort_order: a.sort_order })
    .eq("id", b.id);
  if (e2) throw e2;
}

export async function moveTaskUpAction(formData: FormData) {
  await requireParent();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing task id.");

  const { data: cur, error } = await supabaseAdmin
    .from("tasks")
    .select("id, sort_order")
    .eq("id", id)
    .single();
  if (error || !cur) throw new Error("Task not found.");

  const { data: prev } = await supabaseAdmin
    .from("tasks")
    .select("id, sort_order")
    .lt("sort_order", cur.sort_order)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!prev) return; // already at top

  await swapSortOrders(cur.id, prev.id);
  revalidatePath("/parent/tasks");
  revalidatePath("/");
}

export async function moveTaskDownAction(formData: FormData) {
  await requireParent();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing task id.");

  const { data: cur, error } = await supabaseAdmin
    .from("tasks")
    .select("id, sort_order")
    .eq("id", id)
    .single();
  if (error || !cur) throw new Error("Task not found.");

  const { data: next } = await supabaseAdmin
    .from("tasks")
    .select("id, sort_order")
    .gt("sort_order", cur.sort_order)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!next) return; // already at bottom

  await swapSortOrders(cur.id, next.id);
  revalidatePath("/parent/tasks");
  revalidatePath("/");
}

export async function deleteTaskAction(formData: FormData) {
  await requireParent();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing task id.");

  // Hard-delete. The completions FK is `on delete set null`, so completion
  // history is preserved — only the template row is removed.
  const { error } = await supabaseAdmin.from("tasks").delete().eq("id", id);
  if (error) throw error;

  revalidatePath("/parent/tasks");
  revalidatePath("/");
}
