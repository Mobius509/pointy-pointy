// An optional emoji a parent attaches to a goal or milestone. Keeps the
// first emoji typed (a flag, a family or a skin tone counts as one) and
// nothing else; blank or not an emoji → null.
export function parseEmoji(raw: FormDataEntryValue | string | null | undefined): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  for (const { segment } of new Intl.Segmenter("en", { granularity: "grapheme" }).segment(s))
    if (/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(segment)) return segment.length <= 16 ? segment : null;
  return null;
}

// Writes a row that has an `emoji`; before migration v2_0011 (no emoji
// column yet) it writes the rest without it.
export async function writeWithEmoji<R extends { emoji?: string | null }>(
  write: (row: R | Omit<R, "emoji">) => PromiseLike<{ error: { code?: string } | null }>,
  row: R,
) {
  let { error } = await write(row);
  if (error && (error.code === "42703" || error.code === "PGRST204")) {
    const { emoji: _emoji, ...rest } = row;
    ({ error } = await write(rest));
  }
  if (error) throw error;
}
