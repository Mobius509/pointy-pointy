import confetti from "canvas-confetti";
import {
  confettiStyle,
  imageEl,
  makeLayer,
  shake,
  slamWord,
  type CelebrationOptions,
} from "./shared";
import { playSound } from "./sounds";

type Pt = { x: number; y: number };

// Party-colored exhaust puffs (Tailwind classes backed by the tokens).
const PUFF_CLASSES = ["bg-pp-party-yellow", "bg-pp-party-red", "bg-pp-party-pink", "bg-pp-party-cyan"];

// Catmull-Rom spline through the points, sampled at u ∈ [0, 1].
function spline(points: Pt[], u: number): Pt {
  const n = points.length - 1;
  const t = Math.min(n - 1e-6, Math.max(0, u * n));
  const i = Math.floor(t);
  const f = t - i;
  const p0 = points[Math.max(0, i - 1)];
  const p1 = points[i];
  const p2 = points[i + 1];
  const p3 = points[Math.min(n, i + 2)];
  const c = (a: number, b: number, c2: number, d: number) =>
    0.5 * (2 * b + (-a + c2) * f + (2 * a - 5 * b + 4 * c2 - d) * f * f + (-a + 3 * b - 3 * c2 + d) * f * f * f);
  return { x: c(p0.x, p1.x, p2.x, p3.x), y: c(p0.y, p1.y, p2.y, p3.y) };
}

const easeIn = (t: number) => t * t * t;
const rand = (min: number, max: number) => min + Math.random() * (max - min);

// Points for the middle stretch of the flight: enters from one side, does
// a trick, exits the other. Picked at random so replays look different.
function randomFlightPath(W: number, H: number, size: number): Pt[] {
  const fromLeft = Math.random() < 0.5;
  const x = (f: number) => (fromLeft ? W * f : W * (1 - f)); // mirror for right→left
  const edgeIn = fromLeft ? -size : W + size;
  const edgeOut = fromLeft ? W + size : -size;
  const cy = H * rand(0.25, 0.55);
  const R = Math.min(W, H) * rand(0.14, 0.24);
  const cx = W / 2 + rand(-0.1, 0.1) * W;
  const dir = fromLeft ? 1 : -1; // loop direction follows travel

  const trick = Math.floor(Math.random() * 3);
  if (trick === 0) {
    // Loop-de-loop.
    return [
      { x: edgeIn, y: cy + R * 0.6 },
      { x: x(0.25), y: cy + R },
      { x: cx, y: cy + R },
      { x: cx + R * dir, y: cy },
      { x: cx, y: cy - R },
      { x: cx - R * dir, y: cy },
      { x: cx, y: cy + R },
      { x: x(0.75), y: cy + R },
      { x: edgeOut, y: cy + R * 0.3 },
    ];
  }
  if (trick === 1) {
    // Figure-eight across the screen.
    const r = R * 0.8;
    const l = cx - r * 1.1 * dir;
    const rr = cx + r * 1.1 * dir;
    return [
      { x: edgeIn, y: cy },
      { x: l, y: cy - r },
      { x: cx, y: cy },
      { x: rr, y: cy + r },
      { x: rr + r * dir, y: cy },
      { x: rr, y: cy - r },
      { x: cx, y: cy },
      { x: l, y: cy + r },
      { x: l - r * dir, y: cy },
      { x: l, y: cy - r },
      { x: edgeOut, y: cy - r * 1.5 },
    ];
  }
  // Zig-zag.
  const amp = R * 1.1;
  const zigs = 4 + Math.floor(Math.random() * 3);
  const pts: Pt[] = [{ x: edgeIn, y: cy }];
  for (let i = 1; i <= zigs; i++) pts.push({ x: x(i / (zigs + 1)), y: cy + (i % 2 ? -amp : amp) });
  pts.push({ x: edgeOut, y: cy });
  return pts;
}
const easeOutBack = (t: number) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);

// The avatar rumbles, blasts off the top, swoops back in from one side for
// a random trick (loop-de-loop, figure-eight, zig-zag), exits the other,
// then drops from the sky and crash-lands back on its spot — boom,
// confetti, cheer.
export async function playRocket(opts: CelebrationOptions): Promise<void> {
  const layer = makeLayer();
  const W = window.innerWidth;
  const H = window.innerHeight;

  // Launch pad: the avatar, a tapped point (replay game), or the center.
  const padSize = 120;
  const home =
    (!opts.at && opts.origin?.getBoundingClientRect()) || {
      left: (opts.at?.x ?? W / 2) - padSize / 2,
      top: (opts.at?.y ?? H / 2) - padSize / 2,
      width: padSize,
      height: padSize,
    };
  const size = home.width;
  const start: Pt = { x: home.left + size / 2, y: home.top + size / 2 };

  const hideOrigin = !opts.at && opts.origin;
  if (hideOrigin) opts.origin!.style.visibility = "hidden";
  const ship = imageEl(opts.avatarSrc);
  Object.assign(ship.style, { width: `${size}px`, height: `${size}px`, left: "0", top: "0" });
  layer.appendChild(ship);

  // A different flight every time.
  const loop = randomFlightPath(W, H, size);

  // Timeline (ms): rumble → launch → loop → drop → land.
  const RUMBLE = 650;
  const LAUNCH = 700;
  const LOOP = 2000;
  const DROP = 700;

  let prev = start;
  let lastPuff = 0;
  const place = (p: Pt, rot: number, scale = 1) => {
    ship.style.transform = `translate(${p.x - size / 2}px, ${p.y - size / 2}px) rotate(${rot}deg) scale(${scale})`;
  };
  const heading = (p: Pt) => (Math.atan2(p.y - prev.y, p.x - prev.x) * 180) / Math.PI + 90;

  const puff = (p: Pt, rot: number) => {
    // Exhaust comes out the back (opposite the heading).
    const a = ((rot - 90) * Math.PI) / 180;
    const bx = p.x - Math.cos(a) * size * 0.45;
    const by = p.y - Math.sin(a) * size * 0.45;
    const d = 12 + Math.random() * 16;
    const el = document.createElement("div");
    el.className = `absolute rounded-full ${PUFF_CLASSES[Math.floor(Math.random() * PUFF_CLASSES.length)]}`;
    Object.assign(el.style, { left: `${bx - d / 2}px`, top: `${by - d / 2}px`, width: `${d}px`, height: `${d}px` });
    layer.insertBefore(el, ship);
    el.animate(
      [
        { transform: "scale(1)", opacity: 0.9 },
        { transform: `scale(2.4) translate(${(Math.random() - 0.5) * 20}px, ${(Math.random() - 0.5) * 20}px)`, opacity: 0 },
      ],
      { duration: 550, easing: "ease-out", fill: "forwards" },
    ).finished.then(() => el.remove());
  };

  void playSound("boom");
  await new Promise<void>((resolve) => {
    const t0 = performance.now();
    const frame = (now: number) => {
      const t = now - t0;
      let p: Pt;
      let rot = 0;
      let flying = true;

      if (t < RUMBLE) {
        const k = t / RUMBLE;
        p = { x: start.x + (Math.random() - 0.5) * 6 * k, y: start.y + (Math.random() - 0.5) * 6 * k };
        rot = (Math.random() - 0.5) * 8 * k;
        flying = k > 0.5;
      } else if (t < RUMBLE + LAUNCH) {
        const k = easeIn((t - RUMBLE) / LAUNCH);
        p = { x: start.x, y: start.y - k * (start.y + size * 1.5) };
        rot = 0;
      } else if (t < RUMBLE + LAUNCH + LOOP) {
        const k = (t - RUMBLE - LAUNCH) / LOOP;
        p = spline(loop, k);
        rot = heading(p);
      } else if (t < RUMBLE + LAUNCH + LOOP + DROP) {
        const k = easeOutBack((t - RUMBLE - LAUNCH - LOOP) / DROP);
        p = { x: start.x, y: -size + k * (start.y + size) };
        rot = 180; // falls feet-first… er, head-first
        flying = false;
      } else {
        resolve();
        return;
      }
      if (!layer.isConnected) return; // stopped

      place(p, rot);
      if (flying && now - lastPuff > 28) {
        lastPuff = now;
        puff(p, rot);
      }
      prev = p;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });

  // Crash landing: flip upright with a squash, boom, confetti, cheer.
  void playSound("boom");
  setTimeout(() => void playSound("cheer"), 200);
  shake(layer, 10);
  confetti({ ...confettiStyle(), particleCount: 80, spread: 160, startVelocity: 30, origin: { x: start.x / W, y: start.y / H } });
  slamWord(layer, "TOUCHDOWN!", start.x, Math.max(60, start.y - size), { size: "clamp(34px, 9vw, 54px)", duration: 1400 });
  await ship.animate(
    [
      { transform: `translate(${start.x - size / 2}px, ${start.y - size / 2}px) rotate(180deg)` },
      { transform: `translate(${start.x - size / 2}px, ${start.y - size / 2}px) rotate(360deg) scale(1.3, 0.7)`, offset: 0.4 },
      { transform: `translate(${start.x - size / 2}px, ${start.y - size / 2}px) rotate(360deg) scale(0.9, 1.1)`, offset: 0.7 },
      { transform: `translate(${start.x - size / 2}px, ${start.y - size / 2}px) rotate(360deg) scale(1)` },
    ],
    { duration: 600, easing: "ease-out", fill: "forwards" },
  ).finished;

  if (hideOrigin) opts.origin!.style.visibility = "";
  ship.remove();
  setTimeout(() => layer.remove(), 1500);
}
