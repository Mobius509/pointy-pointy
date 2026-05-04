"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireParent } from "@/lib/auth/pin";

export async function approveCompletionAction(formData: FormData) {
  await requireParent();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id.");
  const { error } = await supabaseAdmin
    .from("completions")
    .update({ status: "approved" })
    .eq("id", id);
  if (error) throw error;

  revalidatePath("/parent");
  revalidatePath("/parent/activity");
  revalidatePath("/");
}

export async function denyCompletionAction(formData: FormData) {
  await requireParent();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id.");
  const { error } = await supabaseAdmin
    .from("completions")
    .delete()
    .eq("id", id);
  if (error) throw error;

  revalidatePath("/parent");
  revalidatePath("/parent/activity");
  revalidatePath("/");
}
