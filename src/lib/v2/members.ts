import "server-only";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";

export type HouseholdMemberRow = {
  user_id: string;
  email: string | null;
  created_at: string;
};

export type PendingInvite = {
  id: string;
  code: string;
  created_at: string;
  expires_at: string;
};

export async function getHouseholdMembers(
  householdId: string,
): Promise<HouseholdMemberRow[]> {
  const { data, error } = await supabaseV2Admin
    .from("household_members")
    .select("user_id, created_at")
    .eq("household_id", householdId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!data) return [];

  // auth.users isn't joinable from PostgREST in the v2 schema, so look up
  // emails one by one via the admin Auth API.
  const rows: HouseholdMemberRow[] = [];
  for (const m of data) {
    const userId = m.user_id as string;
    const { data: u } = await supabaseV2Admin.auth.admin.getUserById(userId);
    rows.push({
      user_id: userId,
      email: u.user?.email ?? null,
      created_at: m.created_at as string,
    });
  }
  return rows;
}

export async function getPendingInvites(
  householdId: string,
): Promise<PendingInvite[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseV2Admin
    .from("household_invites")
    .select("id, code, created_at, expires_at")
    .eq("household_id", householdId)
    .is("accepted_at", null)
    .gte("expires_at", nowIso)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as PendingInvite[]) ?? [];
}
