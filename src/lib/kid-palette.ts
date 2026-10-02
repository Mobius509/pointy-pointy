// The kid app's pastel palette, in any hue. Each kid picks a hue (a
// slider in their settings, kid_profiles.hue); the tone — how light and how
// colorful each color is — never changes, so it's always the same soft
// pastel look, just in their color.
//
// Defined in OKLCH (lightness, chroma, hue) so every hue looks equally
// light; plain HSL would make yellows glare and blues go muddy. The base
// values are sampled from the kid home mock (lavender).
//
// Plain data + math, no imports: used by the server (CSS variables on the
// kid layout), the browser (live preview on the settings slider) and
// mirrored in the iOS app — ios/PointyPoints/Views/Theme.swift. Keep the
// two in sync (GROUND_RULES.md rule 1).

export const BASE_HUE = 304; // the mock's lavender
export const DEFAULT_HUE = BASE_HUE;

// Lightness (0–1), chroma, and hue offset from the kid's hue (the mock's
// light colors lean a few degrees pinker than its strong ones).
export const KID_TOKENS = {
  card: { l: 0.9067, c: 0.0451, dh: 9 }, // the big pastel cards
  cardInner: { l: 0.9258, c: 0.0358, dh: 9 }, // a card inside a card; the ring's track
  cardSoft: { l: 0.9713, c: 0.0135, dh: 10 }, // near-white card, the tab bar
  strong: { l: 0.6703, c: 0.2097, dh: 0 }, // the celebrate card, ring, headings
  strongDeep: { l: 0.5983, c: 0.2037, dh: 0 }, // tiles on a strong card
  track: { l: 0.8728, c: 0.0707, dh: 5 }, // soft accents
  text: { l: 0.4871, c: 0.1933, dh: -2 }, // body text, filled dots
  textStrong: { l: 0.4448, c: 0.2206, dh: -5 }, // big numbers
} as const;

export type KidToken = keyof typeof KID_TOKENS;
export type KidPalette = Record<KidToken, string>; // "#rrggbb"

export function normalizeHue(hue: number | null | undefined): number {
  if (hue === null || hue === undefined || !Number.isFinite(hue)) return DEFAULT_HUE;
  return ((Math.round(hue) % 360) + 360) % 360;
}

export function kidPalette(hue: number | null | undefined): KidPalette {
  const h = normalizeHue(hue);
  const out = {} as KidPalette;
  for (const [name, t] of Object.entries(KID_TOKENS) as [KidToken, (typeof KID_TOKENS)[KidToken]][])
    out[name] = oklchToHex(t.l, t.c, h + t.dh);
  return out;
}

// CSS variables for the kid layout: "--kid-card: 235 216 246" (channels, so
// Tailwind's opacity modifiers work — see tailwind.config.ts).
export function kidCssVars(hue: number | null | undefined): Record<string, string> {
  const p = kidPalette(hue);
  const vars: Record<string, string> = {};
  for (const [name, hex] of Object.entries(p)) {
    const n = parseInt(hex.slice(1), 16);
    vars[`--kid-${kebab(name)}`] = `${n >> 16} ${(n >> 8) & 255} ${n & 255}`;
  }
  return vars;
}

// Inside the kid app the site-wide brand colors (--pp-*, used by the
// checklist, arcade, dialogs, celebration backdrops and the games) follow
// the kid's palette too, so everything takes their color.
const PP_FROM_KID: Record<string, KidToken | "white"> = {
  primary: "text",
  "primary-strong": "textStrong",
  accent: "strong",
  muted: "strongDeep",
  line: "track",
  tint: "card",
  "tint-hover": "track",
  soft: "cardSoft",
  hover: "cardSoft",
  "bg-top": "card",
  "bg-bottom": "cardSoft",
};

// Everything the kid app sets: --kid-* and the --pp-* brand colors.
export function kidThemeVars(hue: number | null | undefined): Record<string, string> {
  const vars = kidCssVars(hue);
  for (const [pp, token] of Object.entries(PP_FROM_KID))
    vars[`--pp-${pp}`] = token === "white" ? "255 255 255" : vars[`--kid-${kebab(token)}`];
  return vars;
}

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

// OKLCH → sRGB hex. A color outside what screens can show gets its chroma
// reduced until it fits (keeping its lightness and hue).
export function oklchToHex(l: number, c: number, h: number): string {
  let lo = 0;
  let hi = c;
  let rgb = oklchToLinearRgb(l, c, h);
  if (!inGamut(rgb)) {
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinearRgb(l, mid, h))) lo = mid;
      else hi = mid;
    }
    rgb = oklchToLinearRgb(l, lo, h);
  }
  return `#${rgb.map((v) => Math.round(toSrgb(v) * 255).toString(16).padStart(2, "0")).join("")}`;
}

function oklchToLinearRgb(L: number, C: number, hDeg: number): [number, number, number] {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

const inGamut = (rgb: number[]) => rgb.every((v) => v >= -0.0001 && v <= 1.0001);

function toSrgb(v: number): number {
  const x = Math.min(1, Math.max(0, v));
  return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
}
