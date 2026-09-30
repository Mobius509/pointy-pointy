import confetti from "canvas-confetti";
import { EMOJI_SOURCES } from "../emojiPhysics";
import {
  color,
  createCanvasGame,
  drawLabel,
  gameInput,
  idleTracker,
  loadImage,
  pointChunks,
  rand,
  runLoop,
  type Area,
} from "./canvasGame";
import { confettiStyle, hintBubble, onStop, type CelebrationOptions, type GameOptions } from "./shared";
import { playSound } from "./sounds";

// Artwork slots — set these once the files exist in public/anims. Until
// then the worm is drawn with shapes.
const WORM_HEAD_SRC: string | undefined = undefined; // e.g. "/anims/worm-head.webp" (facing right)
const WORM_BODY_SRC: string | undefined = undefined; // e.g. "/anims/worm-body.webp" (round segment)

const SEGMENT_SPACING = 9; // px of trail between body segments
const HEAD_R = 20;
const TURN_RATE = 5; // radians per second

type Vec = { x: number; y: number };
type Treat = Vec & { img: HTMLImageElement | null; label?: string; r: number };

type Worm = {
  head: Vec;
  angle: number;
  speed: number;
  segments: number;
  trail: Vec[]; // head positions, newest first
};

async function loadArt() {
  const [head, body] = await Promise.all([loadImage(WORM_HEAD_SRC), loadImage(WORM_BODY_SRC)]);
  const treats = await Promise.all(
    [...EMOJI_SOURCES].sort(() => Math.random() - 0.5).slice(0, 6).map((s) => loadImage(s)),
  );
  return { head, body, treats: treats.filter(Boolean) as HTMLImageElement[] };
}

function newWorm(start: Vec, angle: number): Worm {
  return { head: { ...start }, angle, speed: 170, segments: 8, trail: [] };
}

// Steers toward `target` (if any) at a limited turn rate, moves, and wraps
// around the play area's edges.
function stepWorm(w: Worm, dt: number, area: Area, target: Vec | null) {
  if (target) {
    const want = Math.atan2(target.y - w.head.y, target.x - w.head.x);
    let diff = want - w.angle;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // shortest way round
    w.angle += Math.max(-TURN_RATE * dt, Math.min(TURN_RATE * dt, diff));
  }
  w.head.x += Math.cos(w.angle) * w.speed * dt;
  w.head.y += Math.sin(w.angle) * w.speed * dt;
  if (w.head.x < area.x) w.head.x += area.w;
  if (w.head.x > area.x + area.w) w.head.x -= area.w;
  if (w.head.y < area.y) w.head.y += area.h;
  if (w.head.y > area.y + area.h) w.head.y -= area.h;

  w.trail.unshift({ ...w.head });
  const keep = (w.segments + 2) * SEGMENT_SPACING;
  if (w.trail.length > keep) w.trail.length = keep;
}

function drawWorm(ctx: CanvasRenderingContext2D, w: Worm, art: Awaited<ReturnType<typeof loadArt>>) {
  // Body, tail first so the head sits on top. Segments shrink toward the tail.
  for (let i = w.segments; i >= 1; i--) {
    const p = w.trail[i * SEGMENT_SPACING];
    if (!p) continue;
    const r = HEAD_R * (0.95 - (i / w.segments) * 0.45);
    if (art.body) {
      ctx.drawImage(art.body, p.x - r, p.y - r, r * 2, r * 2);
    } else {
      ctx.fillStyle = color(i % 2 ? "party-pink" : "party-yellow");
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Head.
  ctx.save();
  ctx.translate(w.head.x, w.head.y);
  ctx.rotate(w.angle);
  if (art.head) {
    ctx.drawImage(art.head, -HEAD_R * 1.4, -HEAD_R * 1.4, HEAD_R * 2.8, HEAD_R * 2.8);
  } else {
    ctx.fillStyle = color("party-pink");
    ctx.beginPath();
    ctx.arc(0, 0, HEAD_R, 0, Math.PI * 2);
    ctx.fill();
    for (const side of [-1, 1]) {
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(HEAD_R * 0.35, side * HEAD_R * 0.42, HEAD_R * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color("primary-strong");
      ctx.beginPath();
      ctx.arc(HEAD_R * 0.47, side * HEAD_R * 0.42, HEAD_R * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawTreat(ctx: CanvasRenderingContext2D, t: Treat, time: number) {
  const bob = Math.sin(time * 4 + t.x) * 3;
  if (t.img) ctx.drawImage(t.img, t.x - t.r, t.y - t.r + bob, t.r * 2, t.r * 2);
  else {
    ctx.fillStyle = color("party-yellow");
    ctx.beginPath();
    ctx.arc(t.x, t.y + bob, t.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  if (t.label) drawLabel(ctx, t.label, t.x, t.y + bob - t.r - 10);
}

function eatBurst(x: number, y: number) {
  void playSound("pop");
  confetti({
    ...confettiStyle(),
    particleCount: 18,
    spread: 360,
    startVelocity: 14,
    ticks: 60,
    origin: { x: x / window.innerWidth, y: y / window.innerHeight },
  });
}

// Celebration: a handful of "+N" treats are scattered around; the kid
// steers the worm to them (drag — it follows the finger). Eating the last
// one reveals the points. If they don't touch it, the worm finds the
// treats on its own.
export async function playWorm(opts: CelebrationOptions): Promise<void> {
  const { layer, ctx, W, H, area } = createCanvasGame("celebration");
  const art = await loadArt();
  const worm = newWorm({ x: W / 2, y: area.y + area.h * 0.85 }, -Math.PI / 2);
  const chunks = pointChunks(opts.points ?? 0);

  // Scatter the treats in the upper-middle of the screen, not too close
  // together or to the worm.
  const treats: Treat[] = [];
  for (const [i, n] of chunks.entries()) {
    let p = { x: 0, y: 0 };
    for (let tries = 0; tries < 30; tries++) {
      p = { x: rand(area.x + 40, area.x + area.w - 40), y: rand(area.y + 90, area.y + area.h * 0.7) };
      if (treats.every((t) => Math.hypot(t.x - p.x, t.y - p.y) > 90)) break;
    }
    treats.push({ ...p, img: art.treats[i % art.treats.length] ?? null, label: `+${n}`, r: 22 });
  }

  const hint = hintBubble(layer, "Steer to the treats!", area.y + 16);
  const idle = idleTracker(3000);
  let finger: Vec | null = null;
  gameInput({
    down: (x, y) => {
      finger = { x, y };
      idle.poke();
      hint.remove();
    },
    move: (x, y, pressed) => {
      if (!pressed) return;
      finger = { x, y };
      idle.poke();
    },
    up: () => (finger = null),
  });

  let revealedAt = 0;
  await new Promise<void>((done) => {
    runLoop(layer, (dt, time) => {
      // Follow the finger; if idle, head for the nearest treat by itself.
      const nearest = [...treats].sort(
        (a, b) => Math.hypot(a.x - worm.head.x, a.y - worm.head.y) - Math.hypot(b.x - worm.head.x, b.y - worm.head.y),
      )[0];
      const target = revealedAt
        ? { x: W + 300, y: worm.head.y }
        : finger && !idle.idle()
          ? finger
          : nearest ?? null;
      stepWorm(worm, dt, revealedAt ? { x: -400, y: -400, w: W + 800, h: H + 800 } : area, target);

      for (let i = treats.length - 1; i >= 0; i--) {
        const t = treats[i];
        if (Math.hypot(worm.head.x - t.x, worm.head.y - t.y) < HEAD_R + 16) {
          treats.splice(i, 1);
          worm.segments += 4;
          eatBurst(t.x, t.y);
        }
      }
      if (!revealedAt && treats.length === 0) {
        revealedAt = time;
        hint.remove();
        opts.onReveal?.();
        setTimeout(() => void playSound("cheer"), 150);
      }

      ctx.clearRect(0, 0, W, H);
      treats.forEach((t) => drawTreat(ctx, t, time));
      drawWorm(ctx, worm, art);
      // Slither off after the reveal.
      if (revealedAt && (worm.head.x > W + 80 || time - revealedAt > 3)) {
        done();
        return false;
      }
    });
  });
  layer.remove();
}

// "Keep playing": steer with a finger (the worm follows it), eat treats,
// grow — and don't bite your own tail: that's game over.
export function playWormGame(opts: GameOptions): () => void {
  const { layer, ctx, W, H, area } = createCanvasGame("game");
  let score = 0;
  let target: Vec | null = null;
  const worm = newWorm({ x: area.x + area.w / 2, y: area.y + area.h / 2 }, -Math.PI / 2);
  let art: Awaited<ReturnType<typeof loadArt>> = { head: null, body: null, treats: [] };
  void loadArt().then((a) => (art = a));

  const spawnTreat = (): Treat => ({
    x: rand(area.x + 30, area.x + area.w - 30),
    y: rand(area.y + 30, area.y + area.h - 30),
    img: art.treats.length ? art.treats[Math.floor(Math.random() * art.treats.length)] : null,
    r: 20,
  });
  const treats: Treat[] = [];

  gameInput({
    down: (x, y) => (target = { x, y }),
    move: (x, y, pressed) => {
      if (pressed) target = { x, y };
    },
    up: () => (target = null),
    key: (dir) => {
      worm.angle = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[dir];
    },
  });

  runLoop(layer, (dt, time) => {
    while (treats.length < 4) treats.push(spawnTreat());
    // Slowly speeds up as it grows.
    worm.speed = Math.min(260, 170 + worm.segments * 1.5);
    stepWorm(worm, dt, area, target);

    for (let i = treats.length - 1; i >= 0; i--) {
      const t = treats[i];
      if (Math.hypot(worm.head.x - t.x, worm.head.y - t.y) < HEAD_R + t.r * 0.7) {
        treats.splice(i, 1);
        worm.segments += 3;
        opts.onScore(++score);
        eatBurst(t.x, t.y);
      }
    }

    // Bit its own body? Game over. (Skips the segments right behind the
    // head, and ignores jumps across the wrap-around edges.)
    for (let i = 8; i <= worm.segments; i++) {
      const p = worm.trail[i * SEGMENT_SPACING];
      if (!p) break;
      if (Math.hypot(worm.head.x - p.x, worm.head.y - p.y) < HEAD_R * 0.9) {
        void playSound("boom");
        opts.onGameOver?.();
        return false;
      }
    }

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(area.x, area.y, area.w, area.h, 24);
    ctx.clip();
    treats.forEach((t) => drawTreat(ctx, t, time));
    drawWorm(ctx, worm, art);
    ctx.restore();
  });

  const stop = () => layer.remove();
  onStop(stop);
  return stop;
}

