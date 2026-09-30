import { NextResponse } from "next/server";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { avatarSrc } from "@/lib/avatar";
import { getKidProfiles } from "@/lib/v2/data";
import { jsonError } from "@/lib/v2/kid-api";

// Public: the household name + kid picker list, same as the signed-out web
// kid view shows to anyone holding the household link.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const { data: household, error } = await supabaseV2Admin
    .from("households")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!household) return jsonError("Household not found.", 404);

  const kids = await getKidProfiles(household.id as string);
  return NextResponse.json({
    household: { name: household.name, slug: household.slug },
    kids: kids.map((k) => ({
      id: k.id,
      name: k.name,
      avatarUrl: avatarSrc(k.avatar_emoji),
    })),
  });
}
