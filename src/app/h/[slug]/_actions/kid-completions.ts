"use server";

import { revalidatePath } from "next/cache";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { getKidSession } from "@/lib/v2/auth";
import {
  cancelKidProposal,
  cancelPendingTaskForToday,
  completeTaskForToday,
  recallApprovedTask,
  submitKidProposal,
  type KidContext,
  type OpResult,
} from "@/lib/v2/kid-ops";

// All actions in this file require a valid kid_session cookie. The cookie
// pins the household_id + kid_profile_id, so a kid can only act for
// themselves and only within their own household.
async function requireKidSessionForSlug(slug: string): Promise<KidContext> {
  const session = await getKidSession();
  if (!session) throw new Error("Sign in first.");

  const { data: household, error } = await supabaseV2Admin
    .from("households")
    .select("id, slug, timezone")
    .eq("id", session.householdId)
    .maybeSingle();
  if (error) throw error;
  if (!household || household.slug !== slug) throw new Error("Sign in first.");

  return {
    householdId: session.householdId,
    kidProfileId: session.kidProfileId,
    timezone: household.timezone as string,
  };
}

// Resolve the cookie session, run the op, and revalidate both views on success.
async function withKidSession(
  slug: string,
  op: (ctx: KidContext) => Promise<OpResult>,
): Promise<OpResult> {
  let ctx;
  try {
    ctx = await requireKidSessionForSlug(slug);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const res = await op(ctx);
  if (res.ok) {
    revalidatePath(`/h/${slug}`);
    revalidatePath(`/h/${slug}/parent`);
  }
  return res;
}

export async function completeTaskForTodayAction(
  slug: string,
  taskId: string,
): Promise<OpResult> {
  return withKidSession(slug, (ctx) => completeTaskForToday(ctx, taskId));
}

export async function cancelPendingTaskForTodayAction(
  slug: string,
  taskId: string,
): Promise<OpResult> {
  return withKidSession(slug, (ctx) => cancelPendingTaskForToday(ctx, taskId));
}

export async function recallApprovedTaskAction(
  slug: string,
  taskId: string,
): Promise<OpResult> {
  return withKidSession(slug, (ctx) => recallApprovedTask(ctx, taskId));
}

export async function submitKidProposalAction(
  slug: string,
  name: string,
): Promise<OpResult> {
  return withKidSession(slug, (ctx) => submitKidProposal(ctx, name));
}

export async function cancelKidProposalAction(
  slug: string,
  id: string,
): Promise<OpResult> {
  return withKidSession(slug, (ctx) => cancelKidProposal(ctx, id));
}
