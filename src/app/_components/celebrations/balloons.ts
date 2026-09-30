import confetti from "canvas-confetti";
import {
  confettiStyle,
  hintBubble,
  imageEl,
  makeLayer,
  onStop,
  wait,
  type CelebrationOptions,
} from "./shared";
import { playSound } from "./sounds";

const BALLOON_SRC = "/anims/balloon.webp";
const NEEDLE_SRC = "/anims/needle.webp";
const BALLOON_ASPECT = 897 / 671;
const NEEDLE_ASPECT = 893 / 668;
// Tints of the red balloon artwork toward the party colors.
const TINTS = ["none", "hue-rotate(320deg)", "hue-rotate(45deg) saturate(1.4)", "hue-rotate(180deg)", "hue-rotate(250deg)"];

const FIRST_AUTO_POP_MS = 3800; // nobody playing yet
const IDLE_AUTO_POP_MS = 2500; // they stopped partway
const AUTO_POP_GAP_MS = 450;

// Balloons float up from the bottom. Tapping one jabs it with the needle —
// POP, confetti. The last pop reveals the points. If the kid doesn't play
// (or stops partway), the rest pop on their own so it always finishes.
export async function playBalloons(opts: CelebrationOptions): Promise<void> {
  const layer = makeLayer();
  const W = window.innerWidth;
  const H = window.innerHeight;
  const bw = Math.min(W * 0.24, 120);
  const bh = bw * BALLOON_ASPECT;
  const COUNT = W < 480 ? 5 : 7;

  const hint = hintBubble(layer, "Pop the balloons!", 64);
  let remaining = COUNT;
  let allPopped!: () => void;
  const finished = new Promise<void>((r) => (allPopped = r));
  const pops: ((x?: number, y?: number) => void)[] = [];
  const poppedFlags: boolean[] = [];

  let idle: ReturnType<typeof setTimeout> | undefined;
  onStop(() => clearTimeout(idle));
  // After a pause, pop the next balloon, then keep going until none are left.
  const armIdle = (ms: number) => {
    clearTimeout(idle);
    idle = setTimeout(() => {
      pops.find((_, i) => !poppedFlags[i])?.();
      if (remaining > 1) armIdle(AUTO_POP_GAP_MS);
    }, ms);
  };

  for (let i = 0; i < COUNT; i++) {
    // The wrapper floats; the balloon inside it pops (separate transforms).
    const wrap = document.createElement("div");
    wrap.className = "absolute";
    // Spread across the width with a little jitter.
    const x = ((i + 0.5) / COUNT) * W - bw / 2 + (Math.random() - 0.5) * bw * 0.4;
    Object.assign(wrap.style, { left: `${x}px`, top: `${H}px`, width: `${bw}px`, height: `${bh}px` });
    const balloon = imageEl(BALLOON_SRC, "h-full w-full select-none cursor-pointer");
    Object.assign(balloon.style, {
      filter: TINTS[i % TINTS.length],
      pointerEvents: "auto",
      touchAction: "manipulation",
    });
    wrap.appendChild(balloon);
    layer.appendChild(wrap);

    // Rise into the upper part of the screen with a gentle sway, then bob
    // there — they wait to be popped rather than drifting off.
    const top = H * (0.18 + Math.random() * 0.35);
    const rise = H - top;
    const sway = 20 + Math.random() * 25;
    const flight = wrap.animate(
      [
        { transform: "translate(0, 0) rotate(-4deg)" },
        { transform: `translate(${sway}px, ${-rise * 0.5}px) rotate(5deg)` },
        { transform: `translate(0, ${-rise}px) rotate(-3deg)` },
      ],
      { duration: 2200 + Math.random() * 900, delay: i * 250, easing: "ease-out", fill: "forwards" },
    );
    flight.finished.then(
      () =>
        balloon.animate(
          [{ transform: "translateY(0) rotate(-3deg)" }, { transform: "translateY(-12px) rotate(3deg)" }],
          { duration: 1300 + Math.random() * 500, direction: "alternate", iterations: Infinity, easing: "ease-in-out" },
        ),
      () => {},
    );

    poppedFlags[i] = false;
    const pop = (px?: number, py?: number) => {
      if (poppedFlags[i]) return;
      poppedFlags[i] = true;
      const r = balloon.getBoundingClientRect();
      const tx = px ?? r.left + r.width / 2;
      const ty = py ?? r.top + r.height * 0.4;
      flight.pause();

      // Needle jab from the upper right. Its tip is at the bottom-left of
      // the artwork (~19%, 81%).
      const needle = imageEl(NEEDLE_SRC);
      const nw = bw * 0.7;
      Object.assign(needle.style, {
        width: `${nw}px`,
        height: `${nw * NEEDLE_ASPECT}px`,
        left: `${tx - nw * 0.19}px`,
        top: `${ty - nw * NEEDLE_ASPECT * 0.81}px`,
      });
      layer.appendChild(needle);
      needle
        .animate(
          [
            { transform: "translate(40px, -40px)", opacity: 0 },
            { transform: "translate(0, 0)", opacity: 1, offset: 0.6 },
            { transform: "translate(10px, -10px)", opacity: 0 },
          ],
          { duration: 260, easing: "ease-out", fill: "forwards" },
        )
        .finished.then(() => needle.remove());

      setTimeout(() => {
        void playSound("pop");
        confetti({
          ...confettiStyle(),
          particleCount: 30,
          spread: 360,
          startVelocity: 18,
          ticks: 90,
          origin: { x: tx / W, y: ty / H },
        });
        balloon
          .animate([{ transform: "scale(1)", opacity: 1 }, { transform: "scale(1.35)", opacity: 0 }], {
            duration: 110,
            fill: "forwards",
          })
          .finished.then(() => wrap.remove());
        if (--remaining === 0) allPopped();
      }, 140);
    };
    pops.push(pop);

    balloon.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      hint.remove();
      pop(e.clientX, e.clientY);
      if (remaining > 1) armIdle(IDLE_AUTO_POP_MS);
    });
  }

  armIdle(FIRST_AUTO_POP_MS);
  await finished;
  clearTimeout(idle);
  hint.remove();

  // Last one popped — show the points.
  opts.onReveal?.();
  void playSound("cheer");
  confetti({ ...confettiStyle(), particleCount: 100, spread: 360, startVelocity: 35, origin: { x: 0.5, y: 0.35 } });
  await wait(900);
  layer.remove();
}
