import confetti from "canvas-confetti";
import { EMOJI_SOURCES } from "../emojiPhysics";
import { confettiStyle, imageEl, makeLayer, slamWord, wait, type CelebrationOptions } from "./shared";
import { playSound } from "./sounds";

const REEL_ITEMS = 16; // images per reel strip; the last one is the avatar

// A slot machine pops in and spins three reels of emojis. They stop one by
// one — clunk, clunk, clunk — on three of the kid's avatar. JACKPOT!
export async function playJackpot(opts: CelebrationOptions): Promise<void> {
  const layer = makeLayer();
  const W = window.innerWidth;
  const H = window.innerHeight;
  const width = Math.min(W * 0.88, 360);
  const pad = 14;
  const gap = 10;
  const cell = (width - pad * 2 - gap * 2) / 3;

  const machine = document.createElement("div");
  machine.className = "absolute rounded-3xl bg-white shadow-lg ring-4 ring-pp-party-yellow";
  Object.assign(machine.style, {
    left: `${W / 2 - width / 2}px`,
    top: `${Math.max(24, H * 0.14)}px`,
    width: `${width}px`,
    padding: `${pad}px`,
  });

  const title = document.createElement("div");
  title.textContent = "🎰 SPIN! 🎰";
  title.className = "mb-2 text-center text-lg font-black tracking-wide text-pp-primary";
  machine.appendChild(title);

  const row = document.createElement("div");
  row.className = "flex";
  row.style.gap = `${gap}px`;
  machine.appendChild(row);
  layer.appendChild(machine);

  // Build the reels: a tall strip of random emojis ending on the avatar.
  const stops: Promise<unknown>[] = [];
  const spins: { strip: HTMLElement; duration: number }[] = [];
  for (let r = 0; r < 3; r++) {
    const win = document.createElement("div");
    win.className = "relative overflow-hidden rounded-xl bg-pp-soft";
    Object.assign(win.style, { width: `${cell}px`, height: `${cell}px` });
    const strip = document.createElement("div");
    strip.className = "absolute left-0 top-0";
    for (let i = 0; i < REEL_ITEMS; i++) {
      const src = i === REEL_ITEMS - 1 ? opts.avatarSrc : EMOJI_SOURCES[Math.floor(Math.random() * EMOJI_SOURCES.length)];
      const img = imageEl(src, "block select-none p-1.5");
      Object.assign(img.style, { width: `${cell}px`, height: `${cell}px` });
      strip.appendChild(img);
    }
    win.appendChild(strip);
    row.appendChild(win);
    spins.push({ strip, duration: 1300 + r * 550 });
  }

  // Pop the machine in, then spin.
  await machine.animate(
    [{ transform: "scale(0.5)", opacity: 0 }, { transform: "scale(1.05)", opacity: 1, offset: 0.7 }, { transform: "scale(1)" }],
    { duration: 380, easing: "ease-out" },
  ).finished;

  const travel = -(REEL_ITEMS - 1) * cell;
  spins.forEach(({ strip, duration }) => {
    const anim = strip.animate(
      [
        { transform: "translateY(0)", filter: "blur(0)" },
        { transform: `translateY(${travel * 0.15}px)`, filter: "blur(2px)", offset: 0.1 },
        { transform: `translateY(${travel * 0.9}px)`, filter: "blur(2px)", offset: 0.8 },
        { transform: `translateY(${travel}px)`, filter: "blur(0)" },
      ],
      // Slight overshoot so each reel "clunks" into place.
      { duration, easing: "cubic-bezier(.2,.6,.3,1.08)", fill: "forwards" },
    );
    stops.push(
      anim.finished.then(() => {
        void playSound("pop");
        strip.parentElement?.animate(
          [{ transform: "scale(1)" }, { transform: "scale(1.1)" }, { transform: "scale(1)" }],
          { duration: 220 },
        );
      }),
    );
  });
  await Promise.all(stops);

  // JACKPOT!
  title.textContent = "⭐ JACKPOT! ⭐";
  const r = machine.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  void playSound("boom");
  setTimeout(() => void playSound("cheer"), 200);
  machine.animate(
    [{ transform: "rotate(0)" }, { transform: "rotate(-3deg) scale(1.05)" }, { transform: "rotate(3deg) scale(1.05)" }, { transform: "rotate(0)" }],
    { duration: 450, iterations: 2 },
  );
  slamWord(layer, "JACKPOT!", cx, r.bottom + 40, { duration: 1600 });
  const burst = (x: number, angle: number) =>
    confetti({ ...confettiStyle(), particleCount: 70, angle, spread: 70, startVelocity: 45, origin: { x: x / W, y: cy / H } });
  burst(r.left, 120);
  burst(r.right, 60);
  confetti({ ...confettiStyle(), particleCount: 90, spread: 360, startVelocity: 35, origin: { x: cx / W, y: cy / H } });

  await wait(1900);
  await machine.animate(
    [{ transform: "translateY(0)", opacity: 1 }, { transform: `translateY(${-H * 0.5}px)`, opacity: 0 }],
    { duration: 450, easing: "ease-in", fill: "forwards" },
  ).finished;
  layer.remove();
}
