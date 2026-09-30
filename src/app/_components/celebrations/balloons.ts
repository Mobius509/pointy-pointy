import confetti from "canvas-confetti";
import {
  confettiStyle,
  hintBubble,
  imageEl,
  makeLayer,
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

// Balloons float up from the bottom. Tapping one jabs it with the needle —
// POP, confetti. If nobody taps for a few seconds, they start popping on
// their own so the moment still lands.
export async function playBalloons(_opts: CelebrationOptions): Promise<void> {
  const layer = makeLayer();
  const W = window.innerWidth;
  const H = window.innerHeight;
  const bw = Math.min(W * 0.24, 120);
  const bh = bw * BALLOON_ASPECT;
  const COUNT = W < 480 ? 5 : 7;

  const hint = hintBubble(layer, "Pop the balloons!", 64);

  let touched = false;
  const pops: Promise<void>[] = [];

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

    // Float up past the top with a gentle sway.
    const rise = H + bh * 1.2;
    const sway = 20 + Math.random() * 25;
    const flight = wrap.animate(
      [
        { transform: "translate(0, 0) rotate(-4deg)" },
        { transform: `translate(${sway}px, ${-rise * 0.33}px) rotate(5deg)` },
        { transform: `translate(${-sway}px, ${-rise * 0.66}px) rotate(-5deg)` },
        { transform: `translate(0, ${-rise}px) rotate(3deg)` },
      ],
      { duration: 6500 + Math.random() * 2500, delay: i * 350, easing: "linear", fill: "forwards" },
    );

    let popped = false;
    let resolvePop!: () => void;
    pops.push(new Promise<void>((r) => (resolvePop = r)));
    flight.finished.then(() => resolvePop(), () => {});

    const pop = (px?: number, py?: number) => {
      if (popped) return;
      popped = true;
      const r = balloon.getBoundingClientRect();
      const tx = px ?? r.left + r.width / 2;
      const ty = py ?? r.top + r.height * 0.4;
      flight.pause();

      // Needle jab from the upper right.
      const needle = imageEl(NEEDLE_SRC);
      const nw = bw * 0.7;
      Object.assign(needle.style, {
        width: `${nw}px`,
        height: `${nw * NEEDLE_ASPECT}px`,
        // Tip is at the bottom-left of the artwork (~19%, 81%).
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
          .animate(
            [
              { transform: "scale(1)", opacity: 1 },
              { transform: "scale(1.35)", opacity: 0 },
            ],
            { duration: 110, fill: "forwards" },
          )
          .finished.then(() => {
            wrap.remove();
            resolvePop();
          });
      }, 140);
    };

    balloon.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (!touched) {
        touched = true;
        hint.remove();
      }
      pop(e.clientX, e.clientY);
    });

    // Nobody playing? Pop them one by one so it still celebrates.
    setTimeout(() => {
      if (!touched) pop();
    }, 3800 + i * 450);
  }

  setTimeout(() => hint.remove(), 3500);
  await Promise.all(pops);
  void playSound("cheer");
  await wait(900);
  layer.remove();
}
