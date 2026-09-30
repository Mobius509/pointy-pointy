// Arcade-style initials for high scores (up to 3 letters/numbers).

// Letters and numbers only, uppercase, max 3: "d.a.d" → "DAD".
export function cleanInitials(value: string | null | undefined): string {
  return (value ?? "").replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase();
}

// A kid's default: first initial + last initial. Kids only have a first
// name in the app, so the last initial comes from the family name
// ("Freya" in "Steenburg-Folliott" → "FS"). A kid name with its own last
// word ("Mary Kate") uses that instead.
export function defaultKidInitials(kidName: string, familyName: string): string {
  const kidWords = kidName.trim().split(/\s+/).filter(Boolean);
  const first = kidWords[0]?.[0] ?? "";
  const last = kidWords.length > 1 ? kidWords[kidWords.length - 1][0] : (familyName.trim()[0] ?? "");
  return cleanInitials(first + last) || "???";
}
