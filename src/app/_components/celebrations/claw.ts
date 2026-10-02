import confetti from "canvas-confetti";
import type MatterNS from "matter-js";
import { EMOJI_SOURCES } from "../emojiPhysics";
import { TINTS } from "./balloons";
import { color, createCanvasGame, drawLabel, gameInput, loadImage, rand, runLoop, tinted, type Area } from "./canvasGame";
import { confettiStyle, fadeOutLayer, hintBubble, onStop, type CelebrationOptions, type GameOptions } from "./shared";
import { playSound } from "./sounds";
import { loadMatter } from "./stack";

// Claw machine: the claw glides back and forth on its own — tap to drop
// it. It grabs the ball under it (near the middle always holds; well off
// to the side it may miss or slip), carries it to the prize chute, and the ball pops open: an
// emoji and some points. Balls are a physics pile (matter-js).

// The claw artwork, all at the same scale (sizes in art pixels).
const ART = {
  roof: { src: "/anims/claw-roof.webp", w: 244, h: 115 },
  rod: { src: "/anims/claw-rod.webp", w: 48, h: 46 },
  hub: { src: "/anims/claw-hub.webp", w: 92, h: 93 },
  left: { src: "/anims/claw-arm-left.webp", w: 107, h: 210 },
  right: { src: "/anims/claw-arm-right.webp", w: 108, h: 194 },
};
// Where each arm hangs from the hub (fractions of the hub), and the joint
// on the arm itself (fractions of the arm) it swings around.
const LEFT_ON_HUB = { x: 0.25, y: 0.6 };
const RIGHT_ON_HUB = { x: 0.75, y: 0.6 };
const LEFT_JOINT = { x: 0.85, y: 0.1 };
const RIGHT_JOINT = { x: 0.15, y: 0.12 };
const GRAB_BELOW_HUB = 161; // where a held ball sits, below the hub's top (art px)
const BALL_RADIUS = 40; // art px — fits inside the closed claw
const BALL_SRCS = ["/anims/orb-red.webp", "/anims/orb-pearl.webp"];

type Ball = { body: MatterNS.Body; look: number; emoji: number };
type State = "roam" | "down" | "grab" | "up" | "carry" | "release" | "prize";
type Images = {
  parts: Record<keyof typeof ART, HTMLImageElement | null>;
  balls: (HTMLImageElement | HTMLCanvasElement)[];
  emojis: (HTMLImageElement | null)[];
};

async function loadImages(): Promise<Images> {
  const keys = Object.keys(ART) as (keyof typeof ART)[];
  const [parts, red, pearl, emojis] = await Promise.all([
    Promise.all(keys.map((k) => loadImage(ART[k].src))),
    loadImage(BALL_SRCS[0]),
    loadImage(BALL_SRCS[1]),
    Promise.all(EMOJI_SOURCES.map((s) => loadImage(s))),
  ]);
  const balls: (HTMLImageElement | HTMLCanvasElement)[] = [];
  if (red) for (const t of TINTS) balls.push(tinted(red, t));
  if (pearl) balls.push(pearl);
  return { parts: Object.fromEntries(keys.map((k, i) => [k, parts[i]])) as Images["parts"], balls, emojis };
}

const sparkle = (x: number, y: number) =>
  confetti({
    ...confettiStyle(),
    particleCount: 28,
    spread: 360,
    startVelocity: 16,
    ticks: 60,
    origin: { x: x / window.innerWidth, y: y / window.innerHeight },
  });

// The machine, shared by the celebration and the game. `prize()` is asked
// for each ball won and returns its points (null = keep it empty).
async function createClaw(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  area: Area,
  prize: () => number | null,
  onWon: (points: number, x: number, y: number) => void,
) {
  const M = await loadMatter();
  const img = await loadImages();
  const k = Math.min(0.55, W / 680); // art px → screen px
  const r = BALL_RADIUS * k;
  const floorY = area.y + area.h;
  // The chute is wide enough that the claw can sit over it without its
  // roof running off the screen.
  const roofHalf = (ART.roof.w * k) / 2;
  const chuteW = Math.max(r * 3.4, roofHalf + r + 12);
  const chuteX = Math.max(area.x + chuteW / 2, area.x + roofHalf);
  const pileLeft = area.x + chuteW;
  const railY = area.y + 8;
  const roofH = ART.roof.h * k;
  const restRod = 14 * k;

  const engine = M.Engine.create({ gravity: { x: 0, y: 1, scale: 0.0012 } });
  const wall = (x: number, y: number, w: number, h: number) =>
    M.Bodies.rectangle(x, y, w, h, { isStatic: true, friction: 0.6 });
  M.Composite.add(engine.world, [
    wall(area.x + area.w / 2, floorY + 20, area.w + 200, 40), // floor
    wall(area.x + area.w + 20, area.y + area.h / 2, 40, area.h * 2), // right wall
    wall(pileLeft, floorY - 40, 10, 80), // chute divider
  ]);

  const balls: Ball[] = [];
  let looks = 0;
  const addBall = (x: number, y: number) => {
    const body = M.Bodies.circle(x, y, r, { friction: 0.4, restitution: 0.2, density: 0.002, frictionAir: 0.01 });
    M.Composite.add(engine.world, body);
    balls.push({ body, look: looks++ % Math.max(1, img.balls.length), emoji: Math.floor(Math.random() * EMOJI_SOURCES.length) });
  };
  const fill = (count: number, fromY: number) => {
    for (let i = 0; i < count; i++) addBall(rand(pileLeft + r + 10, area.x + area.w - r - 4), fromY - i * r * 2.2);
  };
  // Start with a settled pile.
  fill(10, floorY - r * 3);
  for (let i = 0; i < 180; i++) M.Engine.update(engine, 1000 / 60);

  // The claw.
  let state: State = "roam";
  let x = area.x + area.w * 0.6;
  let dir = 1;
  let rod = restRod;
  let open = 0.15; // arm swing (radians)
  let timer = 0;
  let held: Ball | null = null;
  let slipAt = -1; // rod length at which a loose grab lets go
  let dropping: { y: number; vy: number; ball: Ball } | null = null;
  let shown: { ball: Ball; points: number; t: number } | null = null;
  let roamSpeed = 120;

  const hubTop = () => railY + roofH + rod;
  const grabPoint = () => ({ x, y: hubTop() + GRAB_BELOW_HUB * k });

  const drop = () => {
    if (state !== "roam") return;
    state = "down";
    void playSound("waka", 1);
  };

  const step = (dt: number, speedUp = 0) => {
    roamSpeed = 120 + speedUp;
    const ms = Math.min(dt, 1 / 20) * 1000;
    if (ms > 0) {
      M.Engine.update(engine, ms / 2);
      M.Engine.update(engine, ms / 2);
    }
    const g = grabPoint();
    switch (state) {
      case "roam": {
        open += (0.15 - open) * Math.min(1, dt * 6);
        x += dir * roamSpeed * dt;
        const lo = pileLeft + r;
        const hi = area.x + area.w - r;
        if (x > hi) (x = hi), (dir = -1);
        if (x < lo) (x = lo), (dir = 1);
        break;
      }
      case "down": {
        open += (0.55 - open) * Math.min(1, dt * 6);
        rod += 280 * dt;
        // Stop on the floor, or on top of a ball under the claw.
        const blocked =
          g.y + r * 0.6 >= floorY ||
          balls.some((b) => Math.abs(b.body.position.x - x) < r * 1.2 && b.body.position.y - g.y < r * 0.6);
        if (blocked) {
          state = "grab";
          timer = 0;
        }
        break;
      }
      case "grab": {
        timer += dt;
        open = 0.55 * Math.max(0, 1 - timer / 0.35);
        if (timer >= 0.35) {
          const near = balls
            .map((b) => ({ b, d: Math.hypot(b.body.position.x - g.x, b.body.position.y - g.y) }))
            .filter((n) => n.d < r * 1.6)
            .sort((a, b) => a.d - b.d)[0];
          if (near) {
            // How far off center it is (0 = dead center, 1 = a ball's width
            // over). Near the middle always holds; well off to the side
            // might miss, or slip out on the way up.
            const off = Math.abs(near.b.body.position.x - x) / r;
            if (off < 0.6 || Math.random() > (off - 0.6) * 1.5) {
              held = near.b;
              M.Composite.remove(engine.world, held.body);
              balls.splice(balls.indexOf(held), 1);
              void playSound("thud");
              slipAt = Math.random() < Math.max(0, off - 0.55) * 1.2 ? rod * 0.5 : -1;
            }
          }
          state = "up";
        }
        break;
      }
      case "up": {
        rod = Math.max(restRod, rod - 240 * dt);
        if (held && slipAt > 0 && rod <= slipAt) {
          // Slipped out!
          const b = held;
          held = null;
          M.Body.setPosition(b.body, g);
          M.Body.setVelocity(b.body, { x: 0, y: 0 });
          M.Composite.add(engine.world, b.body);
          balls.push(b);
          void playSound("pop");
        }
        if (rod <= restRod) state = held ? "carry" : "roam";
        break;
      }
      case "carry": {
        x = Math.max(chuteX, x - 220 * dt);
        if (x <= chuteX) {
          state = "release";
          timer = 0;
        }
        break;
      }
      case "release": {
        timer += dt;
        open += (0.55 - open) * Math.min(1, dt * 8);
        if (held && timer > 0.15) {
          dropping = { y: g.y, vy: 0, ball: held };
          held = null;
        }
        if (dropping) {
          dropping.vy += 1600 * dt;
          dropping.y += dropping.vy * dt;
          if (dropping.y > floorY - r) {
            const points = prize();
            const ball = dropping.ball;
            dropping = null;
            if (points !== null) {
              shown = { ball, points, t: 0 };
              sparkle(chuteX, floorY - r * 2);
              void playSound("powerUp");
              onWon(points, chuteX, floorY - r * 3);
            }
            state = "prize";
            timer = 0;
          }
        }
        break;
      }
      case "prize": {
        timer += dt;
        if (timer > 1.1) {
          state = "roam";
          dir = 1;
        }
        break;
      }
    }
    if (shown && (shown.t += dt) > 1.6) shown = null;
    // Keep the pile topped up.
    if (balls.length + (held ? 1 : 0) < 7) fill(1, area.y + area.h * 0.35);
  };

  const drawBall = (b: Ball, bx: number, by: number, angle = 0) => {
    const src = img.balls[b.look % Math.max(1, img.balls.length)];
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(angle);
    if (src) ctx.drawImage(src, -r, -r, r * 2, r * 2);
    else {
      ctx.fillStyle = color("party-pink");
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  const part = (key: keyof typeof ART, dx: number, dy: number, w = ART[key].w * k, h = ART[key].h * k) => {
    const i = img.parts[key];
    if (i) ctx.drawImage(i, dx, dy, w, h);
  };

  const draw = (time: number) => {
    ctx.clearRect(0, 0, W, H);
    // Rail.
    ctx.fillStyle = color("primary", 0.18);
    ctx.beginPath();
    ctx.roundRect(area.x, railY - 4, area.w, 8, 4);
    ctx.fill();
    // Prize chute.
    ctx.fillStyle = color("primary", 0.12);
    ctx.beginPath();
    ctx.roundRect(area.x, floorY - 80, chuteW - 6, 80, [16, 16, 0, 0]);
    ctx.fill();
    ctx.font = `${Math.round(chuteW * 0.32)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("🎁", chuteX, floorY - 34);
    // Divider and floor line.
    ctx.fillStyle = color("primary", 0.25);
    ctx.beginPath();
    ctx.roundRect(pileLeft - 5, floorY - 80, 10, 80, 5);
    ctx.roundRect(area.x, floorY - 4, area.w, 8, 4);
    ctx.fill();

    for (const b of balls) drawBall(b, b.body.position.x, b.body.position.y, b.body.angle);
    if (dropping) drawBall(dropping.ball, chuteX, dropping.y);

    // The claw: roof, rod, then arms behind the hub (a held ball between them).
    const top = hubTop();
    part("roof", x - (ART.roof.w * k) / 2, railY - 10);
    part("rod", x - (ART.rod.w * k) / 2, railY + roofH - 8, ART.rod.w * k, rod + 16);
    const g = grabPoint();
    if (held) drawBall(held, g.x, g.y);
    const hubLeft = x - (ART.hub.w * k) / 2;
    const arm = (key: "left" | "right", onHub: { x: number; y: number }, joint: { x: number; y: number }, swing: number) => {
      ctx.save();
      ctx.translate(hubLeft + ART.hub.w * k * onHub.x, top + ART.hub.h * k * onHub.y);
      ctx.rotate(swing);
      part(key, -ART[key].w * k * joint.x, -ART[key].h * k * joint.y);
      ctx.restore();
    };
    const wobble = state === "roam" ? Math.sin(time * 4) * 0.03 : 0;
    arm("left", LEFT_ON_HUB, LEFT_JOINT, open + wobble);
    arm("right", RIGHT_ON_HUB, RIGHT_JOINT, -open - wobble);
    part("hub", hubLeft, top);

    // A won ball pops open: its emoji and the points.
    if (shown) {
      const p = Math.min(1, shown.t / 0.3);
      const y = floorY - r * 3.5 - shown.t * 40;
      const e = img.emojis[shown.ball.emoji];
      const size = r * 3.6 * (0.4 + p * 0.6);
      ctx.save();
      ctx.globalAlpha = shown.t > 1.2 ? Math.max(0, 1 - (shown.t - 1.2) / 0.4) : 1;
      if (e) ctx.drawImage(e, chuteX - size / 2, y - size, size, size);
      drawLabel(ctx, `+${shown.points}`, chuteX + size * 0.6, y - size * 0.85, 28);
      ctx.restore();
    }
  };

  return { step, draw, drop, busy: () => state !== "roam", stop: () => M.Engine.clear(engine) };
}

// The celebration's points as 3–4 prizes of different sizes (e.g. 25 →
// 3 + 7 + 5 + 10), so each ball won is a surprise.
function unevenPrizes(total: number): number[] {
  const n = Math.max(1, Math.min(total, total >= 8 ? (Math.random() < 0.5 ? 3 : 4) : 2));
  const weights = Array.from({ length: n }, () => rand(0.5, 1.5));
  const sum = weights.reduce((a, b) => a + b, 0);
  const parts = weights.map((w) => Math.max(1, Math.floor((w / sum) * total)));
  parts[0] += total - parts.reduce((a, b) => a + b, 0);
  return parts.sort(() => Math.random() - 0.5);
}

// Celebration: grab balls until the points are all won (each ball holds a
// different-sized share). The claw glides on its own, but only drops when
// the kid taps.
export async function playClaw(opts: CelebrationOptions): Promise<void> {
  const { layer, ctx, W, H, area } = createCanvasGame("celebration");
  const prizes = unevenPrizes(Math.max(1, opts.points ?? 0));
  let revealed = false;
  let faded = false;
  const hint = hintBubble(layer, "Tap to drop the claw!", area.y + area.h * 0.42);
  const machine = await createClaw(
    ctx,
    W,
    H,
    { ...area, y: area.y + 50, h: area.h - 60 },
    () => (prizes.length ? prizes.shift()! : null),
    () => {
      if (!prizes.length && !revealed) {
        revealed = true;
        opts.onReveal?.();
        setTimeout(() => void playSound("cheer"), 400);
        void fadeOutLayer(layer, 1300).then(() => (faded = true));
      }
    },
  );
  gameInput({
    down: () => {
      hint.remove();
      machine.drop();
    },
  });
  await new Promise<void>((finish) => {
    runLoop(layer, (dt, time) => {
      machine.step(dt);
      machine.draw(time);
      if (faded) {
        finish();
        return false;
      }
    });
  });
  machine.stop();
  layer.remove();
}

// "Keep playing": 45 seconds of grabbing — each ball won is worth 1–5
// points (bigger ones are rarer). The claw speeds up as time goes on.
export function playClawGame(opts: GameOptions): () => void {
  const { layer, ctx, W, H, safe } = createCanvasGame("game");
  let score = 0;
  let elapsed = 0;
  let stop = () => layer.remove();
  const hint = hintBubble(layer, "Tap to drop the claw!", safe.y + safe.h * 0.42);
  const value = () => {
    const roll = Math.random();
    return roll < 0.5 ? 1 : roll < 0.75 ? 2 : roll < 0.9 ? 3 : 5;
  };
  void createClaw(ctx, W, H, safe, value, (points) => opts.onScore((score += points))).then((machine) => {
    gameInput({
      down: () => {
        hint.remove();
        machine.drop();
      },
    });
    runLoop(layer, (dt, time) => {
      elapsed += dt;
      machine.step(dt, Math.min(80, elapsed * 2));
      machine.draw(time);
    });
    const prev = stop;
    stop = () => {
      machine.stop();
      prev();
    };
  });
  onStop(() => stop());
  return () => stop();
}
