"use server";

import { redirect } from "next/navigation";
import { createV2ServerClient } from "@/lib/supabase/v2-server";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";

// Slug-ify a household name. Must be unique across all households; if the
// preferred slug is taken we append a random suffix.
function baseSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "household"
  );
}

async function uniqueSlug(name: string): Promise<string> {
  const base = baseSlug(name);
  for (let i = 0; i < 5; i++) {
    const candidate = i === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const { data } = await supabaseV2Admin
      .from("households")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function signUpAction(formData: FormData): Promise<
  { ok: true; slug: string } | { ok: false; error: string }
> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const householdName = String(formData.get("household_name") ?? "").trim();

  if (!email || !password || !householdName) {
    return { ok: false, error: "Email, password, and family name are required." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  if (householdName.length > 80) {
    return { ok: false, error: "Family name is too long." };
  }

  const supabase = await createV2ServerClient();
  const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
    email,
    password,
  });
  if (signUpErr) return { ok: false, error: signUpErr.message };

  const user = signUpData.user;
  if (!user) {
    return {
      ok: false,
      error:
        "Sign-up didn't complete. If your inbox shows a confirmation email, click it and sign in.",
    };
  }

  // Create household + parent membership via the admin client (bypasses RLS).
  const slug = await uniqueSlug(householdName);
  const { data: household, error: householdErr } = await supabaseV2Admin
    .from("households")
    .insert({ name: householdName, slug })
    .select("id, slug")
    .single();
  if (householdErr) return { ok: false, error: householdErr.message };

  const { error: memberErr } = await supabaseV2Admin
    .from("household_members")
    .insert({
      user_id: user.id,
      household_id: household.id,
      role: "parent",
    });
  if (memberErr) return { ok: false, error: memberErr.message };

  // If email confirmation is required, signUpData.session is null — the user
  // must confirm before they can sign in. Redirect them to sign-in with a hint.
  if (!signUpData.session) {
    redirect(
      `/v2/sign-in?next=${encodeURIComponent(`/v2/h/${household.slug}/parent`)}&confirm=1`,
    );
  }

  redirect(`/v2/h/${household.slug}/parent`);
}
