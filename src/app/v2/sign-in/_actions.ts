"use server";

import { redirect } from "next/navigation";
import { createV2ServerClient } from "@/lib/supabase/v2-server";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";

export async function signInAction(formData: FormData): Promise<
  { ok: true; redirectTo: string } | { ok: false; error: string }
> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");
  if (!email || !password) {
    return { ok: false, error: "Email and password are required." };
  }

  const supabase = await createV2ServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { ok: false, error: error.message };
  if (!data.user) return { ok: false, error: "Sign-in failed." };

  let target = next || "";
  if (!target) {
    // No explicit next: send the parent to their first household's admin.
    const { data: membership } = await supabaseV2Admin
      .from("household_members")
      .select("households(slug)")
      .eq("user_id", data.user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const slug = (membership as { households: { slug: string } | null } | null)
      ?.households?.slug;
    target = slug ? `/v2/h/${slug}/parent` : "/v2";
  }

  redirect(target);
}

export async function signOutAction(): Promise<void> {
  const supabase = await createV2ServerClient();
  await supabase.auth.signOut();
  redirect("/v2");
}
