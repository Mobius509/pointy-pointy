"use server";

import { redirect } from "next/navigation";
import { createV2ServerClient } from "@/lib/supabase/v2-server";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { findValidInvite, markInviteAccepted } from "@/lib/v2/invites";

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
  const inviteCode = String(formData.get("invite") ?? "").trim();

  if (!email || !password) {
    return { ok: false, error: "Email and password are required." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  // Two flows: joining an existing household via invite, or creating a new one.
  let invite = inviteCode ? await findValidInvite(inviteCode) : null;
  if (inviteCode && !invite) {
    return {
      ok: false,
      error:
        "This invite link is invalid or has expired. Ask the parent to send a new one.",
    };
  }
  if (!invite && !householdName) {
    return { ok: false, error: "Family name is required." };
  }
  if (!invite && householdName.length > 80) {
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

  let householdId: string;
  let householdSlug: string;

  if (invite) {
    // Re-validate the invite right before using it. (Race-protection: the
    // parent could have deleted it between page-load and form submit.)
    invite = await findValidInvite(inviteCode);
    if (!invite) {
      return {
        ok: false,
        error: "This invite link was just revoked. Ask the parent for a new one.",
      };
    }
    householdId = invite.household_id;
    householdSlug = invite.household_slug;
    await markInviteAccepted(invite.id, user.id);
  } else {
    const slug = await uniqueSlug(householdName);
    const { data: household, error: householdErr } = await supabaseV2Admin
      .from("households")
      .insert({ name: householdName, slug })
      .select("id, slug")
      .single();
    if (householdErr) return { ok: false, error: householdErr.message };
    householdId = household.id;
    householdSlug = household.slug;
  }

  // Add the user as a parent of the household (works for both flows).
  const { error: memberErr } = await supabaseV2Admin
    .from("household_members")
    .insert({
      user_id: user.id,
      household_id: householdId,
      role: "parent",
    });
  if (memberErr) return { ok: false, error: memberErr.message };

  if (!signUpData.session) {
    redirect(
      `/v2/sign-in?next=${encodeURIComponent(`/v2/h/${householdSlug}/parent`)}&confirm=1`,
    );
  }

  redirect(`/v2/h/${householdSlug}/parent`);
}
