// The kid app's pastel palette, in any hue. Each kid picks a hue (a
// slider in their settings, kid_profiles.hue); the tone — how light and how
// colorful each color is — never changes, so it's always the same soft
// pastel look, just in their color.
//
// Defined in OKLCH (lightness, chroma, hue) so every hue looks equally
// light; plain HSL would make yellows glare and blues go muddy. The base
// values are sampled from the kid home mock (lavender cards on a pink page).
//
// Plain data + math, no imports: used by the server (CSS variables on the
// kid layout), the browser (live preview on the settings slider) and
// mirrored in the iOS app — ios/PointyPoints/Views/Theme.swift. Keep the
// two in sync (GROUND_RULES.md rule 1).

export const BASE_HUE = 304; // the mock's lavender
export const DEFAULT_HUE = BASE_HUE;

// Each color as it is in the mock (OKLCH lightness 0–1, chroma, hue in
// degrees — sampled exactly, so the default palette reproduces the design's
// hex colors). A kid's color turns every hue by the same amount.
export const KID_TOKENS = {
  page: { l: 0.9161, c: 0.0484, h: 323.83 }, // #F4D9F6 the page behind the cards
  chip: { l: 0.8734, c: 0.049, h: 323.85 }, // #E6CBE8 the round buttons on the page (settings, initials)
  panel: { l: 0.8259, c: 0.0932, h: 305.11 }, // #D4B7F7 the goal module and the arcade ticket
  panelSoft: { l: 0.8951, c: 0.0531, h: 306.08 }, // #E5D4F9 a closed card in the goal module
  track: { l: 0.9312, c: 0.0386, h: 307.23 }, // #EFE2FD the ring's paler part, the streak's day pills
  strong: { l: 0.6316, c: 0.2067, h: 288.92 }, // #8A6BFC celebrate card, ring, buttons, nav icons & labels
  strongDeep: { l: 0.5827, c: 0.2268, h: 285.56 }, // #7658F8 tiles on a strong card
  text: { l: 0.4871, c: 0.1933, h: 302.81 }, // #7736B7 headings and body text
  textStrong: { l: 0.4448, c: 0.2206, h: 298.94 }, // #6919B9 big numbers
  nav: { l: 0.199, c: 0.0976, h: 300.0 }, // #1E033A the dark tab bar
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
    out[name] = oklchToHex(t.l, t.c, t.h + (h - DEFAULT_HUE));
  return out;
}

// CSS variables for the kid layout: "--kid-panel: 212 183 247" (channels, so
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
  line: "panel",
  tint: "panelSoft",
  "tint-hover": "panel",
  soft: "track",
  hover: "track",
  "bg-top": "page",
  "bg-bottom": "page",
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
