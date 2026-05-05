"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { getCurrentUser, requireHouseholdAccess } from "@/lib/v2/auth";

// 16-byte URL-safe code, ~22 chars. Plenty of entropy for an invite.
function generateInviteCode(): string {
  return randomBytes(16).toString("base64url");
}

export async function createInviteAction(formData: FormData): Promise<
  { ok: true; code: string } | { ok: false; error: string }
> {
  const slug = String(formData.get("slug") ?? "");
  const household = await requireHouseholdAccess(slug);
  const user = await getCurrentUser();

  const code = generateInviteCode();
  const { error } = await supabaseV2Admin.from("household_invites").insert({
    household_id: household.id,
    code,
    created_by: user?.id ?? null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/v2/h/${slug}/parent/settings`);
  return { ok: true, code };
}

export async function deleteInviteAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const household = await requireHouseholdAccess(slug);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing invite id.");

  const { error } = await supabaseV2Admin
    .from("household_invites")
    .delete()
    .eq("id", id)
    .eq("household_id", household.id);
  if (error) throw error;

  revalidatePath(`/v2/h/${slug}/parent/settings`);
}
