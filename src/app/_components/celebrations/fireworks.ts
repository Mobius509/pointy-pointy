import confetti from "canvas-confetti";
import { confettiStyle, wait, type CelebrationOptions } from "./shared";
import { playSound } from "./sounds";

// Firework-style bursts of confetti popping at random spots in the upper
// half of the screen.
export async function playFireworks(_opts: CelebrationOptions): Promise<void> {
  const duration = 3500;
  const end = Date.now() + duration;
  setTimeout(() => void playSound("cheer"), 500);
  let lastBoom = 0;

  while (Date.now() < end) {
    const left = Date.now() < end - duration / 2;
    confetti({
      ...confettiStyle(),
      particleCount: 70,
      spread: 360,
      startVelocity: 32,
      ticks: 70,
      gravity: 0.9,
      decay: 0.92,
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
