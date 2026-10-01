import confetti from "canvas-confetti";
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

// Artwork slots — set once the files exist in public/anims. Until then the
// ship and rocks are drawn with shapes.
const SHIP_SRC: string | undefined = "/anims/spaceship.webp"; // nose pointing up
const SHIP_ASPECT = 1036 / 776; // height / width of the artwork
const SHIP_W = 60;
const NOSE = (SHIP_W * SHIP_ASPECT) / 2 - 6; // lasers leave from the nose
const ROCK_SRCS: string[] = []; // e.g. ["/anims/asteroid1.webp", "/anims/asteroid2.webp"]

const SIZES = [0, 16, 26, 40]; // radius by rock size (3 = big)
const BULLET_SPEED = 620;

type Rock = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: 1 | 2 | 3;
  rot: number;
  spin: number;
  shape: number[]; // placeholder outline: radius multipliers around the rim
  img: HTMLImageElement | null;
  label?: string;
};
type Bullet = { x: number; y: number; vx: number; vy: number; life: number };

function newRock(x: number, y: number, size: 1 | 2 | 3, art: HTMLImageElement[], speed = 60): Rock {
  const a = rand(0, Math.PI * 2);
  return {
    x,
    y,
    vx: Math.cos(a) * speed,
    vy: Math.sin(a) * speed,
    size,
    rot: rand(0, Math.PI * 2),
    spin: rand(-1.2, 1.2),
    shape: Array.from({ length: 10 }, () => rand(0.75, 1.1)),
    img: art.length ? art[Math.floor(Math.random() * art.length)] : null,
  };
}

function drawRock(ctx: CanvasRenderingContext2D, r: Rock) {
  const R = SIZES[r.size];
  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.rotate(r.rot);
  if (r.img) ctx.drawImage(r.img, -R * 1.2, -R * 1.2, R * 2.4, R * 2.4);
  else {
    ctx.fillStyle = color("muted");
    ctx.strokeStyle = color("primary-strong", 0.5);
    ctx.lineWidth = 2;
    ctx.beginPath();
    r.shape.forEach((m, i) => {
      const a = (i / r.shape.length) * Math.PI * 2;
      const px = Math.cos(a) * R * m;
      const py = Math.sin(a) * R * m;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // A couple of craters.
    ctx.fillStyle = color("primary-strong", 0.25);
    ctx.beginPath();
    ctx.arc(R * 0.25, -R * 0.2, R * 0.2, 0, Math.PI * 2);
    ctx.arc(-R * 0.3, R * 0.25, R * 0.14, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (r.label) drawLabel(ctx, r.label, r.x, r.y);
}

function drawShip(
  ctx: CanvasRenderingContext2D,
  art: HTMLImageElement | null,
  x: number,
  y: number,
  angle: number,
  flash: boolean,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + Math.PI / 2); // artwork points up; angle 0 = right
  if (flash) ctx.globalAlpha = 0.4;
  if (art) {
    const w = SHIP_W;
    const h = w * SHIP_ASPECT;
    ctx.drawImage(art, -w / 2, -h / 2, w, h);
  }
  else {
    ctx.fillStyle = color("primary");
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.lineTo(18, 20);
    ctx.lineTo(0, 12);
    ctx.lineTo(-18, 20);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = color("accent");
    ctx.beginPath();
    ctx.arc(0, -4, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBullets(ctx: CanvasRenderingContext2D, bullets: Bullet[]) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = 5;
  ctx.strokeStyle = color("party-yellow");
  ctx.shadowColor = color("party-pink");
  ctx.shadowBlur = 10;
  for (const b of bullets) {
    const len = 0.03;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * len, b.y - b.vy * len);
    ctx.stroke();
  }
  ctx.restore();
}

function boom(x: number, y: number, big: boolean) {
  void playSound(big ? "boom" : "pop");
  confetti({
    ...confettiStyle(),
    particleCount: big ? 40 : 18,
    spread: 360,
    startVelocity: big ? 22 : 14,
    ticks: 70,
    origin: { x: x / window.innerWidth, y: y / window.innerHeight },
  });
}

const wrap = (r: { x: number; y: number }, area: Area, pad: number) => {
  if (r.x < area.x - pad) r.x = area.x + area.w + pad;
  if (r.x > area.x + area.w + pad) r.x = area.x - pad;
  if (r.y < area.y - pad) r.y = area.y + area.h + pad;
  if (r.y > area.y + area.h + pad) r.y = area.y - pad;
};

function fire(ship: { x: number; y: number; angle: number }, bullets: Bullet[]) {
  bullets.push({
    x: ship.x + Math.cos(ship.angle) * NOSE,
    y: ship.y + Math.sin(ship.angle) * NOSE,
    vx: Math.cos(ship.angle) * BULLET_SPEED,
    vy: Math.sin(ship.angle) * BULLET_SPEED,
    life: 1.4,
  });
  void playSound("pop");
}

// Glides the ship toward `target` (eased, capped speed), kept inside the
// play area. Returns true while it's still on the way.
const SHIP_SPEED = 340;
function fly(ship: { x: number; y: number }, target: { x: number; y: number } | null, area: Area, dt: number) {
  if (!target) return false;
  const pad = 30;
  target.x = Math.max(area.x + pad, Math.min(area.x + area.w - pad, target.x));
  target.y = Math.max(area.y + pad, Math.min(area.y + area.h - pad, target.y));
  const dx = target.x - ship.x;
  const dy = target.y - ship.y;
  const d = Math.hypot(dx, dy);
  if (d < 3) return false;
  const move = Math.min(d, Math.max(60, Math.min(SHIP_SPEED, d * 5)) * dt);
  ship.x += (dx / d) * move;
  ship.y += (dy / d) * move;
  return true;
}

// Turns `ship.angle` toward `want`, at most `rate` radians per second.
function turn(ship: { angle: number }, want: number, rate: number, dt: number) {
  const diff = Math.atan2(Math.sin(want - ship.angle), Math.cos(want - ship.angle));
  ship.angle += Math.max(-rate * dt, Math.min(rate * dt, diff));
  return Math.abs(diff);
}

// Moves bullets and returns the rocks they hit (bullets are used up).
function hits(bullets: Bullet[], rocks: Rock[], dt: number): Rock[] {
  const hit: Rock[] = [];
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    const target = rocks.find((r) => !hit.includes(r) && Math.hypot(r.x - b.x, r.y - b.y) < SIZES[r.size] + 4);
    if (target) hit.push(target);
    if (target || b.life <= 0) bullets.splice(i, 1);
  }
  return hit;
}

// Celebration: rocks labeled "+N" float around the ship. Tap to fire —
// a tap on (or near) a rock locks onto it and the ship moves in a little;
// a tap on empty space flies the ship there. The last rock reveals the
// points. If nobody taps, the ship takes aim by itself after a moment.
export async function playAsteroids(opts: CelebrationOptions): Promise<void> {
  const { layer, ctx, W, H, area } = createCanvasGame("celebration");
  const [shipArt, ...rockArt] = await Promise.all([loadImage(SHIP_SRC), ...ROCK_SRCS.map((s) => loadImage(s))]);
  const art = rockArt.filter(Boolean) as HTMLImageElement[];
  const ship = { x: W / 2, y: area.y + area.h * 0.55, angle: -Math.PI / 2 };
  const chunks = pointChunks(opts.points ?? 0);
  // Rocks on a ring around the ship, drifting slowly.
  const rocks: Rock[] = chunks.map((n, i) => {
    const a = (i / chunks.length) * Math.PI * 2 - Math.PI / 2;
    const d = Math.min(W, H) * 0.32;
    const r = newRock(ship.x + Math.cos(a) * d, ship.y + Math.sin(a) * d, 3, art, 10);
    r.label = `+${n}`;
    return r;
  });
  const bullets: Bullet[] = [];
  const hint = hintBubble(layer, "Tap the rocks!", area.y + 16);
  const idle = idleTracker(3000);
  let autoCooldown = 0;
  let done = false;
  let target: { x: number; y: number } | null = null;
  let locked = false; // aimed at a tapped rock: keep facing it while moving in

  gameInput({
    down: (x, y) => {
      idle.poke();
      hint.remove();
      // Snap to a rock near the tap so little fingers don't have to be exact.
      const near = rocks.find((r) => Math.hypot(r.x - x, r.y - y) < SIZES[r.size] + 40);
      locked = !!near;
      if (!near) {
        target = { x, y };
        return;
      }
      ship.angle = Math.atan2(near.y - ship.y, near.x - ship.x);
      fire(ship, bullets);
      // Edge a bit closer, but not on top of it.
      const d = Math.hypot(near.x - ship.x, near.y - ship.y);
      target = d < 140 ? null : { x: near.x - (near.x - ship.x) * (120 / d), y: near.y - (near.y - ship.y) * (120 / d) };
    },
  });

  await new Promise<void>((finish) =>
    runLoop(layer, (dt) => {
      // Idle: aim at the next rock and fire on our own.
      if (fly(ship, target, area, dt)) {
        if (!locked) turn(ship, Math.atan2(target!.y - ship.y, target!.x - ship.x), 10, dt);
      } else target = null;
      if (idle.idle() && rocks[0] && !done) {
        const diff = turn(ship, Math.atan2(rocks[0].y - ship.y, rocks[0].x - ship.x), 8, dt);
        autoCooldown -= dt;
        if (diff < 0.05 && autoCooldown <= 0) {
          fire(ship, bullets);
          autoCooldown = 0.5;
        }
      }
      for (const r of rocks) {
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        r.rot += r.spin * dt;
      }
      for (const r of hits(bullets, rocks, dt)) {
        rocks.splice(rocks.indexOf(r), 1);
        boom(r.x, r.y, true);
        if (rocks.length === 0 && !done) {
          done = true;
          hint.remove();
          opts.onReveal?.();
          setTimeout(() => void playSound("cheer"), 150);
          setTimeout(finish, 1200);
        }
      }
      ctx.clearRect(0, 0, W, H);
      rocks.forEach((r) => drawRock(ctx, r));
      drawBullets(ctx, bullets);
      drawShip(ctx, shipArt, ship.x, ship.y, ship.angle, false);
    }),
  );
  layer.remove();
}

// "Keep playing": tap (or drag) anywhere and the ship flies there, facing
// the way it's going; it fires on its own, and when it stops it turns
// toward the nearest rock. Rocks split big → medium → small (+1 each hit) and keep
// coming, faster over time. Three lives: a rock hitting the ship costs
// one, and the last one is game over.
export function playAsteroidsGame(opts: GameOptions): () => void {
  const { layer, ctx, W, H, area } = createCanvasGame("game");
  let shipArt: HTMLImageElement | null = null;
  let art: HTMLImageElement[] = [];
  void loadImage(SHIP_SRC).then((i) => (shipArt = i));
  void Promise.all(ROCK_SRCS.map((s) => loadImage(s))).then(
    (imgs) => (art = imgs.filter(Boolean) as HTMLImageElement[]),
  );

  const ship = { x: area.x + area.w / 2, y: area.y + area.h / 2, angle: -Math.PI / 2 };
  const rocks: Rock[] = [];
  const bullets: Bullet[] = [];
  let score = 0;
  let lives = 3;
  opts.onLives?.(lives);
  let target: { x: number; y: number } | null = null;
  const hint = hintBubble(layer, "Tap anywhere to fly!", area.y + 16);
  let bonked = 0;
  let spawnIn = 0;
  let elapsed = 0;

  // Rocks drift in from the edges of the play area.
  const spawn = () => {
    const edge = Math.floor(Math.random() * 4);
    const x = edge === 0 ? area.x - 40 : edge === 1 ? area.x + area.w + 40 : rand(area.x, area.x + area.w);
    const y = edge === 2 ? area.y - 40 : edge === 3 ? area.y + area.h + 40 : rand(area.y, area.y + area.h);
    const r = newRock(x, y, 3, art, 45 + elapsed * 1.5);
    // Head roughly toward the middle.
    const a = Math.atan2(ship.y - y, ship.x - x) + rand(-0.5, 0.5);
    const sp = Math.hypot(r.vx, r.vy);
    r.vx = Math.cos(a) * sp;
    r.vy = Math.sin(a) * sp;
    rocks.push(r);
  };

  gameInput({
    down: (x, y) => {
      hint.remove();
      target = { x, y };
    },
    move: (x, y, pressed) => {
      if (pressed) target = { x, y };
    },
    key: (dir) => {
      hint.remove();
      const [dx, dy] = { right: [1, 0], down: [0, 1], left: [-1, 0], up: [0, -1] }[dir];
      target = { x: ship.x + dx * 90, y: ship.y + dy * 90 };
    },
  });

  let autoFire = 0;
  runLoop(layer, (dt) => {
    elapsed += dt;
    bonked = Math.max(0, bonked - dt);
    // Flying: face the way it's going. Stopped: turn toward the nearest rock.
    if (fly(ship, target, area, dt)) {
      turn(ship, Math.atan2(target!.y - ship.y, target!.x - ship.x), 12, dt);
    } else {
      target = null;
      const nearest = rocks.reduce<Rock | null>(
        (best, r) =>
          !best || Math.hypot(r.x - ship.x, r.y - ship.y) < Math.hypot(best.x - ship.x, best.y - ship.y) ? r : best,
        null,
      );
      if (nearest) turn(ship, Math.atan2(nearest.y - ship.y, nearest.x - ship.x), 5, dt);
    }
    // Always firing.
    autoFire -= dt;
    if (autoFire <= 0 && rocks.length) {
      fire(ship, bullets);
      autoFire = 0.3;
    }

    spawnIn -= dt;
    if (spawnIn <= 0 && rocks.length < 9) {
      spawn();
      spawnIn = Math.max(0.9, 2.4 - elapsed * 0.06);
    }

    for (const r of rocks) {
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.rot += r.spin * dt;
      wrap(r, area, 50);
      // Hit! Lose a life; the rock shatters and the ship flashes (safe for
      // a moment). No lives left: game over.
      if (bonked === 0 && Math.hypot(r.x - ship.x, r.y - ship.y) < SIZES[r.size] + 24) {
        bonked = 1.5;
        lives -= 1;
        opts.onLives?.(lives);
        boom(ship.x, ship.y, true);
        r.size = 1;
        r.vx = (r.x - ship.x) * 3;
        r.vy = (r.y - ship.y) * 3;
      }
    }
    if (lives <= 0) {
      opts.onGameOver?.();
      return false;
    }

    for (const r of hits(bullets, rocks, dt)) {
      rocks.splice(rocks.indexOf(r), 1);
      opts.onScore(++score);
      boom(r.x, r.y, r.size === 3);
      if (r.size > 1) {
        for (let k = 0; k < 2; k++) {
          const piece = newRock(r.x, r.y, (r.size - 1) as 1 | 2, art, 70 + elapsed);
          rocks.push(piece);
        }
      }
    }

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(area.x, area.y, area.w, area.h, 24);
    ctx.clip();
    rocks.forEach((r) => drawRock(ctx, r));
    drawBullets(ctx, bullets);
    drawShip(ctx, shipArt, ship.x, ship.y, ship.angle, bonked > 0 && Math.floor(bonked * 12) % 2 === 0);
    ctx.restore();
  });

  const stop = () => layer.remove();
  onStop(stop);
  return stop;
}
