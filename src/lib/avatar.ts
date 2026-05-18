// Shared avatar resolution. The `kid_profiles.avatar_emoji` column may hold
// either a legacy single-character emoji ("🐶") or one of the new avatar
// filename stems ("monster1", "dog1", …). This helper normalizes both into
// a /avatars/*.png path so views never have to branch.

// All PNG stems present in /public/avatars/. Used both as the picker source
// of truth and as the allow-list when validating server-side input.
export const AVATAR_IDS = [
  "monster1",
  "monster2",
  "monster3",
  "dog1",
  "dog2",
  "cat1",
  "cat2",
  "unicorn",
  "fish",
  "gamer1",
  "girl1",
  "girl2",
  "kid1",
  "kid2",
  "kid3",
  "kid4",
  "kid5",
  "kid6",
  "kid7",
  "kid8",
  "kid9",
  "kid10",
  "kid11",
  "kid12",
  "sports1",
  "sports2",
  "sports3",
  "sports4",
  "sports5",
  "house1",
  "house2",
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

const AVATAR_ID_SET = new Set<string>(AVATAR_IDS);

// Default if the stored value is empty or unrecognized.
export const DEFAULT_AVATAR: AvatarId = "monster1";

// Legacy emoji → new filename. Anything not in this map falls back to the
// default avatar so we never render a broken image.
const EMOJI_TO_AVATAR: Record<string, AvatarId> = {
  "🐶": "dog1",
  "🐕": "dog1",
  "🐩": "dog2",
  "🐱": "cat1",
  "🐈": "cat1",
  "🐯": "cat2",
  "🦄": "unicorn",
  "🐸": "monster1",
  "🦖": "monster1",
  "🐻": "monster2",
  "🦊": "monster3",
};

// Pull the avatar id out of whatever was stored. Accepts: a new-style id
// ("monster1"), a legacy emoji ("🐶"), or junk (returns default).
export function avatarId(value: string | null | undefined): AvatarId {
  if (!value) return DEFAULT_AVATAR;
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_AVATAR;
  if (AVATAR_ID_SET.has(trimmed)) return trimmed as AvatarId;
  if (EMOJI_TO_AVATAR[trimmed]) return EMOJI_TO_AVATAR[trimmed];
  return DEFAULT_AVATAR;
}

// Public URL of the PNG for a given stored value.
export function avatarSrc(value: string | null | undefined): string {
  return `/avatars/${avatarId(value)}.png`;
}
