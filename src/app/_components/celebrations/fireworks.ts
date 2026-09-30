import confetti from "canvas-confetti";
import { BRAND, EFFECT_Z, PARTY, tokenHex, wait, type CelebrationOptions } from "./shared";
import { playSound } from "./sounds";

// Firework bursts popping at random spots in the upper half of the screen.
export async function playFireworks(_opts: CelebrationOptions): Promise<void> {
  const colors = tokenHex([...PARTY, ...BRAND]);
  const duration = 3500;
  const end = Date.now() + duration;
  setTimeout(() => void playSound("cheer"), 500);
  let lastBoom = 0;

  while (Date.now() < end) {
    const left = Date.now() < end - duration / 2;
    confetti({
      colors,
      zIndex: EFFECT_Z,
      disableForReducedMotion: true,
      particleCount: 70,
      spread: 360,
      startVelocity: 32,
      ticks: 70,
      gravity: 0.9,
      decay: 0.92,
      shapes: ["circle"],
      scalar: 0.9,
      origin: {
        x: left ? 0.1 + Math.random() * 0.35 : 0.55 + Math.random() * 0.35,
        y: 0.1 + Math.random() * 0.35,
      },
    });
    // A boom every ~1.2s — every burst would be a wall of noise.
    if (Date.now() - lastBoom > 1200) {
      lastBoom = Date.now();
      void playSound("boom");
    }
    await wait(260 + Math.random() * 200);
  }
  await wait(1200);
}
