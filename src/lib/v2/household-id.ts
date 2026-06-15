import "server-only";
import { randomBytes } from "node:crypto";
import { supabaseV2Admin } from "@/lib/supabase/v2-admin";

// URL-safe alphabet with ambiguous characters removed (no 0/1/I/l/O). 56
// chars; 10 of them gives 56^10 ≈ 3×10^17 distinct slugs — non-enumerable
// in any realistic attack window.
const ALPHABET =
  "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
const SLUG_LEN = 10;

function randomSlug(): string {
  const bytes = randomBytes(SLUG_LEN);
  let out = "";
  for (let i = 0; i < SLUG_LEN; i++) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return out;
}

// Returns a fresh slug that isn't already in v2.households. Collisions are
// astronomically unlikely; we still re-roll a few times before giving up
// so a freak collision degrades gracefully instead of throwing.
export async function generateUniqueHouseholdSlug(): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const candidate = randomSlug();
    const { data } = await supabaseV2Admin
      .from("households")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  throw new Error("Could not allocate a unique household slug.");
}
