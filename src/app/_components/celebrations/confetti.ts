import confetti from "canvas-confetti";
import { BRAND, EFFECT_Z, PARTY, tokenHex, wait, type CelebrationOptions } from "./shared";
import { playSound } from "./sounds";

// Full-screen confetti: a pop from both sides, then a steady fall from the
// top of the screen for a few seconds (the "You earned" mockup look).
export async function playConfetti(_opts: CelebrationOptions): Promise<void> {
  const colors = tokenHex([...PARTY, ...BRAND]);
  const base = { colors, zIndex: EFFECT_Z, disableForReducedMotion: true };
  void playSound("pop");
  setTimeout(() => void playSound("cheer"), 200);

  confetti({ ...base, particleCount: 90, angle: 60, spread: 70, startVelocity: 60, origin: { x: 0, y: 0.75 } });
  confetti({ ...base, particleCount: 90, angle: 120, spread: 70, startVelocity: 60, origin: { x: 1, y: 0.75 } });

  const end = Date.now() + 3200;
  await new Promise<void>((resolve) => {
    (function frame() {
      confetti({
        ...base,
        particleCount: 4,
        startVelocity: 0,
        gravity: 0.6,
        ticks: 400,
        scalar: 1.2,
        drift: Math.random() - 0.5,
        origin: { x: Math.random(), y: -0.05 },
      });
      if (Date.now() < end) requestAnimationFrame(frame);
      else resolve();
    })();
  });
  await wait(2500); // let the last pieces fall
}
