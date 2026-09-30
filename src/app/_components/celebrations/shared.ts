// Helpers shared by the celebration effects. Colors come from the tokens
// in globals.css (no hex literals here — see the one-stylesheet rule).

export type CelebrationOptions = {
  avatarSrc: string;
  // The on-screen avatar the effect should play from (the "You earned"
  // screen's avatar). Effects fall back to the viewport center without it.
  origin?: HTMLElement | null;
};

export const PARTY = ["party-pink", "party-yellow", "party-cyan", "party-red"];
export const BRAND = ["primary", "accent"];

// "R G B" channels for a --pp-* token.
export function tokenRgb(name: string): [number, number, number] {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(`--pp-${name}`)
    .trim();
  const [r, g, b] = raw.split(/\s+/).map(Number);
  return [r || 0, g || 0, b || 0];
}

// canvas-confetti needs "#rrggbb" strings.
export function tokenHex(names: string[]): string[] {
  return names.map((n) =>
    "#" + tokenRgb(n).map((c) => c.toString(16).padStart(2, "0")).join(""),
  );
}

export function originPoint(el?: HTMLElement | null): { x: number; y: number } {
  if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Effects draw above the celebration screen (z-60) but never block taps.
export const EFFECT_Z = 70;

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
