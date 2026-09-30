import "server-only";
import { NextResponse } from "next/server";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { avatarSrc } from "@/lib/avatar";
import { verifyKidToken } from "@/lib/v2/kid-token";
import type { KidContext, KidTodayView, OpResult } from "@/lib/v2/kid-ops";

// Helpers for the native kid API (/api/v2/kid/*). Responses are camelCase
// JSON; errors are { error: string } with an appropriate status code.

export function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export function opResponse(res: OpResult) {
  return res.ok ? NextResponse.json({ ok: true }) : jsonError(res.error, 400);
}

// Resolve `Authorization: Bearer <token>` into a kid context. Returns a
// 401 response instead if the token is missing, invalid, expired, or points
// at a household that no longer exists.
export async function requireKidFromRequest(
  req: Request,
): Promise<{ ctx: KidContext } | { response: NextResponse }> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const session = token ? verifyKidToken(token) : null;
  if (!session) return { response: jsonError("Sign in first.", 401) };

  const { data: household, error } = await supabaseV2Admin
    .from("households")
    .select("id, timezone")
    .eq("id", session.householdId)
    .maybeSingle();
  if (error) throw error;
  if (!household) return { response: jsonError("Sign in first.", 401) };

  return {
    ctx: {
      householdId: session.householdId,
      kidProfileId: session.kidProfileId,
      timezone: household.timezone as string,
    },
  };
}

export function serializeTodayView(view: KidTodayView) {
  const { kid, goal, progress, milestones, items, pendingProposals } = view;
  return {
    kid: {
      id: kid.id,
      name: kid.name,
      avatarUrl: avatarSrc(kid.avatar_emoji),
    },
    goal: goal
      ? { id: goal.id, name: goal.name, targetPoints: goal.target_points }
      : null,
    progress,
    milestones: milestones.map((m) => ({
      id: m.id,
      name: m.name,
      points: m.points,
    })),
    items,
    pendingProposals: pendingProposals.map((p) => ({
      id: p.id,
      name: p.task_name_snapshot,
    })),
  };
}
