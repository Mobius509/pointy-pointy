import confetti from "canvas-confetti";

// Helpers shared by the celebration effects. Colors come from the tokens
// in globals.css (no hex literals here — see the one-stylesheet rule).

export type CelebrationOptions = {
  avatarSrc: string;
  // The on-screen avatar the effect should play from (the "You earned"
  // screen's avatar). Effects fall back to the viewport center without it.
  origin?: HTMLElement | null;
  // The white points circle, for effects that cover/reveal it (scratch card).
  target?: HTMLElement | null;
  // Points being celebrated (parade signs, scratch-card fallback).
  points?: number;
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

// The one confetti look used by every effect (the "You earned" mockup):
// party colors only, square pieces. Spread into any confetti() call.
export function confettiStyle() {
  return {
    colors: tokenHex(PARTY),
    shapes: ["square"] as ["square"],
    scalar: 1.2,
    zIndex: EFFECT_Z,
    disableForReducedMotion: true,
  };
}

// ----- Stop switch -----------------------------------------------------------
// Everything an effect puts on screen or keeps running registers a cleanup
// here, so closing the celebration screen (or starting another one) can
// clear it all at once — nothing lingers over the next screen.
const cleanups = new Set<() => void>();

export function onStop(fn: () => void): () => void {
  cleanups.add(fn);
  return () => cleanups.delete(fn);
}

export function stopAllCelebrations() {
  for (const fn of [...cleanups]) {
    try {
      fn();
    } catch {
      /* already gone */
    }
  }
  cleanups.clear();
  confetti.reset();
}

// A full-screen layer for an effect. Non-interactive layers let every tap
// through; interactive effects opt individual elements back in with
// `pointer-events: auto`.
export function makeLayer(): HTMLDivElement {
  const layer = document.createElement("div");
  layer.className = "pointer-events-none fixed inset-0 overflow-hidden";
  layer.style.zIndex = String(EFFECT_Z);
  document.body.appendChild(layer);
  const unregister = onStop(() => layer.remove());
  // Unregister when the effect removes the layer itself.
  const observer = new MutationObserver(() => {
    if (!layer.isConnected) {
      unregister();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true });
  return layer;
}

export function imageEl(src: string, className = "absolute select-none"): HTMLImageElement {
  const img = document.createElement("img");
  img.src = src;
  img.alt = "";
  img.draggable = false;
  img.className = className;
  return img;
}

// Quick screen shake for impacts.
export function shake(el: HTMLElement, strength = 7) {
  const s = strength;
  el.animate(
    [
      { transform: "translate(0,0)" },
      { transform: `translate(${-s}px,${s * 0.6}px)` },
      { transform: `translate(${s * 0.85}px,${-s * 0.7}px)` },
      { transform: `translate(${-s * 0.55}px,${s * 0.4}px)` },
      { transform: "translate(0,0)" },
    ],
    { duration: 260 },
  );
}

// Big comic word ("BONK!", "JACKPOT!") that slams in and fades.
export function slamWord(
  layer: HTMLElement,
  text: string,
  x: number,
  y: number,
  opts: { size?: string; duration?: number; tilt?: number } = {},
) {
  const word = document.createElement("div");
  word.textContent = text;
  word.className = "absolute font-black text-pp-primary text-outline-white whitespace-nowrap";
  Object.assign(word.style, {
    left: `${x}px`,
    top: `${y}px`,
    fontSize: opts.size ?? "clamp(40px, 11vw, 64px)",
  });
  layer.appendChild(word);
  const tilt = opts.tilt ?? -6;
  const t = (scale: number) => `translate(-50%, -50%) scale(${scale}) rotate(${tilt}deg)`;
  word
    .animate(
      [
        { transform: t(0.2), opacity: 0 },
        { transform: t(1.15), opacity: 1, offset: 0.25 },
        { transform: t(1), opacity: 1, offset: 0.75 },
        { transform: t(1), opacity: 0 },
      ],
      { duration: opts.duration ?? 1200, easing: "ease-out", fill: "forwards" },
    )
    .finished.then(() => word.remove());
}

// Slices an image into a grid of tiles that fly outward, spin, and fade —
// the "avatar go boom" / piñata burst. Resolves when the tiles are gone.
export function explodeImage(
  layer: HTMLElement,
  src: string,
  rect: { left: number; top: number; width: number; height: number },
  grid = 6,
): Promise<unknown> {
  const tw = rect.width / grid;
  const th = rect.height / grid;
  const flights: Promise<unknown>[] = [];
  for (let row = 0; row < grid; row++) {
    for (let col = 0; col < grid; col++) {
      const tile = document.createElement("div");
      tile.className = "absolute";
      Object.assign(tile.style, {
        left: `${rect.left + col * tw}px`,
        top: `${rect.top + row * th}px`,
        width: `${tw}px`,
        height: `${th}px`,
        backgroundImage: `url("${src}")`,
        backgroundSize: `${rect.width}px ${rect.height}px`,
        backgroundPosition: `${-col * tw}px ${-row * th}px`,
      });
      layer.appendChild(tile);

      // Fly away from the center, a little randomized, with some gravity.
      const dx = col - (grid - 1) / 2 + (Math.random() - 0.5);
      const dy = row - (grid - 1) / 2 + (Math.random() - 0.5);
      const len = Math.hypot(dx, dy) || 1;
      const dist = 250 + Math.random() * 450;
      const tx = (dx / len) * dist;
      const ty = (dy / len) * dist + 120;
      const spin = (Math.random() - 0.5) * 900;
      flights.push(
        tile
          .animate(
            [
              { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
              { opacity: 1, offset: 0.6 },
              { transform: `translate(${tx}px, ${ty}px) rotate(${spin}deg)`, opacity: 0 },
            ],
            {
              duration: 1100 + Math.random() * 400,
              easing: "cubic-bezier(.15,.8,.3,1)",
              fill: "forwards",
            },
          )
          .finished.then(() => tile.remove()),
      );
    }
  }
  return Promise.all(flights);
}

// Resolves on whichever comes first: the promise, or `ms` elapsing.
export function withTimeout(promise: Promise<unknown>, ms: number): Promise<unknown> {
  return Promise.race([promise, wait(ms)]);
}

// A bouncing instruction bubble ("Tap to whack it!"), centered at `top`.
// The bounce lives on an inner element so it doesn't fight the centering
// transform on the outer one.
export function hintBubble(layer: HTMLElement, text: string, top: number): HTMLElement {
  const outer = document.createElement("div");
  outer.className = "absolute left-1/2 -translate-x-1/2";
  outer.style.top = `${top}px`;
  const inner = document.createElement("div");
  inner.textContent = text;
  inner.className =
    "rounded-full bg-white px-4 py-2 font-bold text-pp-primary shadow-sm whitespace-nowrap animate-bounce";
  outer.appendChild(inner);
  layer.appendChild(outer);
  return outer;
}
