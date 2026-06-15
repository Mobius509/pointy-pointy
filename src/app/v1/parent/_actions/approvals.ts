"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireParent } from "@/lib/auth/pin";
import { sendPushToRole } from "@/lib/push";

export async function approveCompletionAction(formData: FormData) {
  await requireParent();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id.");

  // If a points value is supplied (kid proposal flow), update points too.
  const pointsRaw = formData.get("points");
  const update: { status: "approved"; points_snapshot?: number } = {
    status: "approved",
  };
  if (pointsRaw !== null && pointsRaw !== "") {
    const points = Number(pointsRaw);
    if (!Number.isFinite(points) || points < 0 || points > 1000) {
      throw new Error("Points must be between 0 and 1000.");
    }
    update.points_snapshot = Math.round(points);
  }

  const { data, error } = await supabaseAdmin
    .from("completions")
    .update(update)
    .eq("id", id)
    .select("task_name_snapshot, points_snapshot")
    .single();
  if (error) throw error;

  await sendPushToRole("kid", {
    title: "🎉 Approved!",
    body: `${data.task_name_snapshot} · +${data.points_snapshot} points`,
    url: "/v1",
    tag: `approve-${id}`,
  });

  revalidatePath("/v1/parent");
  revalidatePath("/v1/parent/activity");
  revalidatePath("/v1");
}

export async function denyCompletionAction(formData: FormData) {
  await requireParent();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id.");

  const { data: row } = await supabaseAdmin
    .from("completions")
    .select("task_name_snapshot")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabaseAdmin
    .from("completions")
    .delete()
    .eq("id", id);
  if (error) throw error;

  if (row?.task_name_snapshot) {
    await sendPushToRole("kid", {
      title: "Pointy Points",
      body: `"${row.task_name_snapshot}" wasn't approved this time.`,
      url: "/v1",
      tag: `deny-${id}`,
    });
  }

  revalidatePath("/v1/parent");
  revalidatePath("/v1/parent/activity");
  revalidatePath("/v1");
}
