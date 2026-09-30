import "server-only";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";

// Family high scores for the celebration mini games (v2.high_scores): one
// best score per household per game, with the kid who set it.

export type HighScore = { score: number; initials: string };
export type HighScores = Record<string, HighScore>;

// Games that keep a high score. Anything else is rejected.
const GAMES = new Set(["pinata", "balloons", "worm", "chomper", "asteroids"]);
const MAX_SCORE = 100_000; // sanity cap

// Arcade-style initials: first letter of each word, or the first three
// letters of a one-word name. "Freya" → "FRE", "Mary Kate" → "MK".
export function initialsFor(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "???";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

// Missing table (migration v2_0007 not applied yet) → no high scores,
// rather than breaking the kid view.
const missingTable = (code?: string) => code === "42P01" || code === "PGRST205";

type Row = { game: string; score: number; kid_profiles: { name: string } | { name: string }[] | null };
const kidName = (r: Row) => (Array.isArray(r.kid_profiles) ? r.kid_profiles[0]?.name : r.kid_profiles?.name);

export async function getHighScores(householdId: string): Promise<HighScores> {
  const { data, error } = await supabaseV2Admin
    .from("high_scores")
    .select("game, score, kid_profiles(name)")
    .eq("household_id", householdId);
  if (error) {
    if (missingTable(error.code)) return {};
    throw error;
  }
  const out: HighScores = {};
  for (const r of (data ?? []) as unknown as Row[]) {
    out[r.game] = { score: r.score, initials: initialsFor(kidName(r)) };
  }
  return out;
}

// Saves `score` if it beats the family's best for `game`. Returns the best
// afterwards and whether this score set it.
export async function submitHighScore(
  householdId: string,
  kidProfileId: string,
  game: string,
  score: number,
): Promise<{ best: HighScore; isNew: boolean } | { error: string }> {
  if (!GAMES.has(game)) return { error: "Unknown game." };
  if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) return { error: "Bad score." };

  const { data: current, error } = await supabaseV2Admin
    .from("high_scores")
    .select("game, score, kid_profiles(name)")
    .eq("household_id", householdId)
    .eq("game", game)
    .maybeSingle();
  if (error) {
    if (missingTable(error.code)) return { error: "High scores aren't set up yet." };
    return { error: error.message };
  }
  const row = current as unknown as Row | null;
  if (row && row.score >= score) {
    return { best: { score: row.score, initials: initialsFor(kidName(row)) }, isNew: false };
  }
  if (score === 0) return { best: { score: 0, initials: "" }, isNew: false };

  const { error: upsertError } = await supabaseV2Admin.from("high_scores").upsert(
    {
      household_id: householdId,
      game,
      score,
      kid_profile_id: kidProfileId,
      achieved_at: new Date().toISOString(),
    },
    { onConflict: "household_id,game" },
  );
  if (upsertError) return { error: upsertError.message };

  const { data: kid } = await supabaseV2Admin
    .from("kid_profiles")
    .select("name")
    .eq("id", kidProfileId)
    .maybeSingle();
  return { best: { score, initials: initialsFor(kid?.name as string | undefined) }, isNew: true };
}
