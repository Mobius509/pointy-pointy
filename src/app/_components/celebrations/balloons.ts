import confetti from "canvas-confetti";
import {
  confettiStyle,
  hintBubble,
  imageEl,
  makeLayer,
  onStop,
  wait,
  type CelebrationOptions,
  type GameOptions,
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
// Endless game: more balloons than anyone can pop, and it speeds up.
const GAME_SPAWN_START_MS = 480;
const GAME_SPAWN_FASTEST_MS = 200;
const GAME_RAMP_MS = 25000; // reaches full speed after this long

type Balloon = { pop: (x?: number, y?: number) => void; popped: () => boolean };

// Releases one balloon from below the screen. "bob" rises into the upper
// part of the screen and waits there; "away" floats up and off the top
// (endless game). Tapping it jabs the needle — POP, confetti, onPop().
function releaseBalloon(
  layer: HTMLElement,
  {
    x,
    index,
    behavior,
    delay = 0,
    riseMs,
    onPop,
    onGone,
  }: {
    x: number;
    index: number;
    behavior: "bob" | "away";
    delay?: number;
    riseMs?: number; // "away": time to float off the top
    onPop: (byTap: boolean) => void;
    onGone?: () => void; // floated off the top without being popped
  },
): Balloon {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const bw = Math.min(W * 0.24, 120);
  const bh = bw * BALLOON_ASPECT;

  // The wrapper floats; the balloon inside it pops (separate transforms).
  const wrap = document.createElement("div");
  wrap.className = "absolute";
  Object.assign(wrap.style, { left: `${x - bw / 2}px`, top: `${H}px`, width: `${bw}px`, height: `${bh}px` });
  const balloon = imageEl(BALLOON_SRC, "h-full w-full select-none cursor-pointer");
  Object.assign(balloon.style, {
    filter: TINTS[index % TINTS.length],
    pointerEvents: "auto",
    touchAction: "manipulation",
  });
  wrap.appendChild(balloon);
  layer.appendChild(wrap);

  const sway = 20 + Math.random() * 25;
  let flight: Animation;
  if (behavior === "bob") {
    const rise = H - H * (0.18 + Math.random() * 0.35);
    flight = wrap.animate(
      [
        { transform: "translate(0, 0) rotate(-4deg)" },
        { transform: `translate(${sway}px, ${-rise * 0.5}px) rotate(5deg)` },
        { transform: `translate(0, ${-rise}px) rotate(-3deg)` },
      ],
      { duration: 2200 + Math.random() * 900, delay, easing: "ease-out", fill: "forwards" },
    );
    flight.finished.then(
      () =>
        balloon.animate(
          [{ transform: "translateY(0) rotate(-3deg)" }, { transform: "translateY(-12px) rotate(3deg)" }],
          { duration: 1300 + Math.random() * 500, direction: "alternate", iterations: Infinity, easing: "ease-in-out" },
        ),
      () => {},
    );
  } else {
    const rise = H + bh * 1.3;
    flight = wrap.animate(
      [
        { transform: "translate(0, 0) rotate(-4deg)" },
        { transform: `translate(${sway}px, ${-rise * 0.33}px) rotate(5deg)` },
        { transform: `translate(${-sway}px, ${-rise * 0.66}px) rotate(-5deg)` },
        { transform: `translate(0, ${-rise}px) rotate(3deg)` },
      ],
      { duration: riseMs ?? 4500 + Math.random() * 2500, delay, easing: "linear", fill: "forwards" },
    );
    flight.finished.then(
      () => {
        if (!popped) {
          wrap.remove();
          onGone?.();
        }
      },
      () => {},
    );
  }

  let popped = false;
  const pop = (px?: number, py?: number, byTap = false) => {
    if (popped) return;
    popped = true;
    const r = balloon.getBoundingClientRect();
    const tx = px ?? r.left + r.width / 2;
    const ty = py ?? r.top + r.height * 0.4;
    flight.pause();

    // Needle jab from the upper right. Its tip is at the bottom-left of the
    // artwork (~19%, 81%).
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
      onPop(byTap);
    }, 140);
  };

  balloon.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    pop(e.clientX, e.clientY, true);
  });

  return { pop: (x, y) => pop(x, y), popped: () => popped };
}

// The celebration: a handful of balloons rise and bob. The last pop reveals
// the points. If the kid doesn't play (or stops partway), the rest pop on
// their own so it always finishes.
export async function playBalloons(opts: CelebrationOptions): Promise<void> {
  const layer = makeLayer();
  const W = window.innerWidth;
  const COUNT = W < 480 ? 5 : 7;
  const hint = hintBubble(layer, "Pop the balloons!", 64);

  let remaining = COUNT;
  let allPopped!: () => void;
  const finished = new Promise<void>((r) => (allPopped = r));
  const balloons: Balloon[] = [];

  let idle: ReturnType<typeof setTimeout> | undefined;
  onStop(() => clearTimeout(idle));
  // After a pause, pop the next balloon, then keep going until none are left.
  const armIdle = (ms: number) => {
    clearTimeout(idle);
    idle = setTimeout(() => {
      balloons.find((b) => !b.popped())?.pop();
      if (remaining > 1) armIdle(AUTO_POP_GAP_MS);
    }, ms);
  };

  for (let i = 0; i < COUNT; i++) {
    // Spread across the width with a little jitter.
    const x = ((i + 0.5) / COUNT) * W + (Math.random() - 0.5) * 30;
    balloons.push(
      releaseBalloon(layer, {
        x,
        index: i,
        behavior: "bob",
        delay: i * 250,
        onPop: (byTap) => {
          if (byTap) {
            hint.remove();
            if (remaining > 1) armIdle(IDLE_AUTO_POP_MS);
          }
          if (--remaining === 0) allPopped();
        },
      }),
    );
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

// "Keep playing": balloons keep floating up — more than anyone can pop,
// faster as the round goes on. Every pop counts; the screen runs the round
// timer. Returns a stop function.
export function playBalloonGame(opts: GameOptions): () => void {
  const layer = makeLayer();
  const W = window.innerWidth;
  let popped = 0;
  let index = 0;
  const hint = hintBubble(layer, "Pop as many as you can!", 96);

  const started = performance.now();
  // 0 → 1 over the ramp: spawns come faster and balloons rise quicker.
  const ramp = () => Math.min(1, (performance.now() - started) / GAME_RAMP_MS);

  const spawn = () =>
    releaseBalloon(layer, {
      x: 40 + Math.random() * (W - 80),
      index: index++,
      behavior: "away",
      riseMs: (4200 - ramp() * 1600) * (0.8 + Math.random() * 0.4),
      onPop: () => {
        hint.remove();
        opts.onScore(++popped);
      },
    });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const loop = () => {
    spawn();
    if (Math.random() < 0.15 + ramp() * 0.3) spawn(); // sometimes two at once
    const gap = GAME_SPAWN_START_MS - ramp() * (GAME_SPAWN_START_MS - GAME_SPAWN_FASTEST_MS);
    timer = setTimeout(loop, gap * (0.7 + Math.random() * 0.6));
  };
  for (let i = 0; i < 4; i++) setTimeout(spawn, i * 200);
  timer = setTimeout(loop, 800);

  const stop = () => {
    clearTimeout(timer);
    layer.remove();
  };
  onStop(stop);
  return stop;
}
