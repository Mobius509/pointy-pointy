"use client";

import confetti from "canvas-confetti";

// canvas-confetti needs literal colors, so read the brand tokens from
// globals.css at fire time instead of hard-coding them here.
function tokenColors(names: string[]): string[] {
  const style = getComputedStyle(document.documentElement);
  return names.map((n) => `rgb(${style.getPropertyValue(`--pp-${n}`).trim().split(/\s+/).join(",")})`);
}

// Brand indigo/blue plus a couple of cheerful non-brand pops.
const CELEBRATION_EXTRAS = ["gold", "hotpink"];

export function celebrate(opts: { big?: boolean } = {}) {
  if (typeof window === "undefined") return;
  const big = opts.big ?? false;

  if (big) {
    const end = Date.now() + 1800;
    const colors = [...tokenColors(["primary", "accent", "line"]), ...CELEBRATION_EXTRAS];
    (function frame() {
      confetti({
        particleCount: 6,
        angle: 60,
        spread: 70,
        origin: { x: 0 },
        colors,
      });
      confetti({
        particleCount: 6,
        angle: 120,
        spread: 70,
        origin: { x: 1 },
        colors,
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
    return;
  }

  confetti({
    particleCount: 70,
    spread: 65,
    startVelocity: 35,
    origin: { y: 0.7 },
    colors: [...tokenColors(["primary", "accent", "tint-hover"]), ...CELEBRATION_EXTRAS],
  });
}
