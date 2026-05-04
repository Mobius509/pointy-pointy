"use client";

import confetti from "canvas-confetti";

export function celebrate(opts: { big?: boolean } = {}) {
  if (typeof window === "undefined") return;
  const big = opts.big ?? false;

  if (big) {
    const end = Date.now() + 1800;
    const colors = ["#fb923c", "#f97316", "#fbbf24", "#fde68a", "#fda4af"];
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
    colors: ["#fb923c", "#f97316", "#fbbf24", "#34d399"],
  });
}
