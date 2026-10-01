import "server-only";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";
import { cleanInitials, defaultKidInitials } from "@/lib/initials";
import { ARCADE_GAMES } from "@/lib/games";
import { notifyHighScore, type ScoreHolder } from "@/lib/v2/push";

// Family high scores for the celebration mini games (v2.high_scores): one
// best score per household per game, held by a kid or (when the family
// lets parents play) a parent.

export type HighScore = { score: number; initials: string };
export type HighScores = Record<string, HighScore>;
export type { ScoreHolder };

// Games that keep a high score, with the names used in notifications.
const GAME_NAMES: Record<string, string> = Object.fromEntries(ARCADE_GAMES.map((g) => [g.id, g.name]));
const MAX_SCORE = 100_000; // sanity cap

// Arcade-style initials: first letter of each word, or the first three
// letters of a one-word name. "Freya" → "FRE", "Mary Kate" → "MK",
// a parent's "DAD" stays "DAD".
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

// Missing table/columns (migration v2_0007 not applied yet) → no high
// scores, rather than breaking the page.
const notSetUp = (code?: string) => code === "42P01" || code === "PGRST205" || code === "42703" || code === "PGRST204";

type Row = {
  game: string;
  score: number;
  kid_profile_id: string | null;
  user_id: string | null;
  holder_name: string | null;
};
const COLUMNS = "game, score, kid_profile_id, user_id, holder_name";

export async function getHighScores(householdId: string): Promise<HighScores> {
  const { data, error } = await supabaseV2Admin
    .from("high_scores")
    .select(COLUMNS)
    .eq("household_id", householdId);
  if (error) {
    if (notSetUp(error.code)) return {};
    throw error;
  }
  const out: HighScores = {};
  for (const r of (data ?? []) as Row[]) {
    out[r.game] = { score: r.score, initials: initialsFor(r.holder_name) };
  }
  return out;
}

// Saves `score` if it beats the family's best for `game`, and pings whoever
// lost the record (and, for a parent's record, challenges the kids).
export async function submitHighScore(
  householdId: string,
  holder: ScoreHolder,
  game: string,
  score: number,
): Promise<{ best: HighScore; isNew: boolean } | { error: string }> {
  const gameName = GAME_NAMES[game];
  if (!gameName) return { error: "Unknown game." };
  if (!Number.isInteger(score) || score <= 0 || score > MAX_SCORE) return { error: "Bad score." };

  const { data: current, error } = await supabaseV2Admin
    .from("high_scores")
    .select(COLUMNS)
    .eq("household_id", householdId)
    .eq("game", game)
    .maybeSingle();
  if (error) {
    if (notSetUp(error.code)) return { error: "High scores aren't set up yet." };
    return { error: error.message };
  }
  const row = current as Row | null;
  if (row && row.score >= score) {
    return { best: { score: row.score, initials: initialsFor(row.holder_name) }, isNew: false };
  }

  const { error: upsertError } = await supabaseV2Admin.from("high_scores").upsert(
    {
      household_id: householdId,
      game,
      score,
      kid_profile_id: holder.kind === "kid" ? holder.kidProfileId : null,
      user_id: holder.kind === "parent" ? holder.userId : null,
      holder_name: holder.name,
      achieved_at: new Date().toISOString(),
    },
    { onConflict: "household_id,game" },
  );
  if (upsertError) return { error: upsertError.message };

  const previous: ScoreHolder | null = row?.kid_profile_id
    ? { kind: "kid", kidProfileId: row.kid_profile_id, name: row.holder_name ?? "" }
    : row?.user_id
      ? { kind: "parent", userId: row.user_id, name: row.holder_name ?? "" }
      : null;
  notifyHighScore(householdId, gameName, score, holder, previous);

  return { best: { score, initials: initialsFor(holder.name) }, isNew: true };
}

// Wipes the family's high score for one game.
export async function clearHighScores(householdId: string, game: string): Promise<{ ok: boolean }> {
  const { error } = await supabaseV2Admin
    .from("high_scores")
    .delete()
    .eq("household_id", householdId)
    .eq("game", game);
  return { ok: !error || notSetUp(error.code) };
}

// Someone changed their initials: show the new ones on records they hold.
export async function renameHighScoreHolder(
  householdId: string,
  holder: { kind: "kid"; kidProfileId: string } | { kind: "parent"; userId: string },
  name: string,
) {
  const q = supabaseV2Admin.from("high_scores").update({ holder_name: name }).eq("household_id", householdId);
  await (holder.kind === "kid" ? q.eq("kid_profile_id", holder.kidProfileId) : q.eq("user_id", holder.userId));
}

// ----- Parents playing ---------------------------------------------------------

export async function getParentsPlay(householdId: string): Promise<boolean> {
  const { data, error } = await supabaseV2Admin
    .from("households")
    .select("parents_play")
    .eq("id", householdId)
    .maybeSingle();
  if (error) return false; // column not there yet → off
  return (data?.parents_play as boolean | undefined) ?? true;
}

// A parent's high score name: what they set, else their email's first
// three letters.
export async function getParentScoreName(
  householdId: string,
  userId: string,
  email: string | undefined,
): Promise<string> {
  const { data } = await supabaseV2Admin
    .from("household_members")
    .select("score_name")
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .maybeSingle();
  const set = (data?.score_name as string | null | undefined)?.trim();
  return set || (email ?? "").split("@")[0].slice(0, 3).toUpperCase() || "???";
}

// ----- Kid initials -------------------------------------------------------------

// Every kid's high score initials: what a parent set, else the default
// (first initial + family initial). Works before the initials column
// exists (defaults only).
export async function getKidInitials(householdId: string): Promise<Record<string, string>> {
  const { data: household } = await supabaseV2Admin
    .from("households")
    .select("name")
    .eq("id", householdId)
    .maybeSingle();
  const family = (household?.name as string | undefined) ?? "";

  let rows: { id: string; name: string; initials?: string | null }[] = [];
  const withInitials = await supabaseV2Admin
    .from("kid_profiles")
    .select("id, name, initials")
    .eq("household_id", householdId);
  if (withInitials.error) {
    const plain = await supabaseV2Admin.from("kid_profiles").select("id, name").eq("household_id", householdId);
    rows = (plain.data ?? []) as typeof rows;
  } else {
    rows = (withInitials.data ?? []) as typeof rows;
  }
  return Object.fromEntries(
    rows.map((k) => [k.id, cleanInitials(k.initials) || defaultKidInitials(k.name, family)]),
  );
}
