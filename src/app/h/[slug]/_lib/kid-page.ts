import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { getKidSession } from "@/lib/v2/auth";
import { getKidHome, type KidHome } from "@/lib/v2/kid-home";
import type { KidContext } from "@/lib/v2/kid-ops";
import { DEFAULT_HUE } from "@/lib/kid-palette";
import { wantsDefaultKidColor } from "./kid-version";

export type KidPage = {
  household: { id: string; name: string; slug: string; timezone: string };
  ctx: KidContext | null;
  home: KidHome | null; // null: signed out (or the kid's been removed)
};

// The household and signed-in kid for a kid page — loaded once per
// request and shared by the kid layout and the page (React cache).
export const loadKidPage = cache(async (slug: string): Promise<KidPage> => {
  const { data: household, error } = await supabaseV2Admin
    .from("households")
    .select("id, name, slug, timezone")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!household) notFound();

  // A session for a kid that's since been removed counts as signed out
  // (pages can't clear cookies; signing in again replaces it).
  const session = await getKidSession();
  const ctx =
    session && session.householdId === household.id
      ? { householdId: household.id as string, kidProfileId: session.kidProfileId, timezone: household.timezone as string }
      : null;
  const home = ctx ? await getKidHome(ctx) : null;
  // Dev switch: show the default palette instead of the kid's own color.
  if (home && (await wantsDefaultKidColor())) home.hue = DEFAULT_HUE;
  return { household: household as KidPage["household"], ctx: home ? ctx : null, home };
});

// Inside the iOS app's web view (the arcade and celebrations run the web
// versions for now): the app draws its own bars, so the web's are hidden.
// Set by /api/v2/kid/web-session.
export const EMBED_COOKIE = "pp_embed";
export async function isEmbedded(): Promise<boolean> {
  return (await cookies()).get(EMBED_COOKIE)?.value === "1";
}
