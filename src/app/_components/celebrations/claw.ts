import confetti from "canvas-confetti";
import type MatterNS from "matter-js";
import { EMOJI_SOURCES } from "../emojiPhysics";
import { TINTS } from "./balloons";
import { color, createCanvasGame, drawLabel, gameInput, loadImage, rand, runLoop, tinted, type Area } from "./canvasGame";
import { confettiStyle, fadeOutLayer, hintBubble, onStop, type CelebrationOptions, type GameOptions } from "./shared";
import { playSound } from "./sounds";
import { loadMatter } from "./stack";

// Claw machine: the claw glides back and forth on its own — tap to drop
// it. It only catches a ball that's lined up under it (off to the side is
// a miss), carries it to the prize chute, and the ball pops open: an
// emoji and some points. Balls are a physics pile (matter-js).

// The claw artwork, all at the same scale (sizes in art pixels). It hangs
// from the top of the screen on its rod: head, then two arms whose round
// discs sit right over the head's hinge wheel and swing around its center.
const ART = {
  rod: { src: "/anims/claw-rod.webp", w: 24, h: 87 },
  head: { src: "/anims/claw-head.webp", w: 209, h: 315 },
  left: { src: "/anims/claw-left.webp", w: 211, h: 241 },
  right: { src: "/anims/claw-right.webp", w: 210, h: 241 },
};
const HINGE = { x: 104.75, y: 252.5 }; // center of the head's hinge wheel
const LEFT_HINGE = { x: 149.5, y: 61 }; // center of the left arm's disc
const RIGHT_HINGE = { x: 62.5, y: 60.5 }; // center of the right arm's disc
const GRAB_BELOW_HINGE = 110; // where a held ball sits, below the hinge
const TIP_BELOW_HINGE = 164; // the fingertips (closed), below the hinge…
const TIP_OUT = 44; // …and out to each side
const CLAW_HALF_WIDTH = 150; // from the hinge to the far side of an arm
const BALL_RADIUS = 57; // art px — fits inside the closed claw
const BALL_SRCS = ["/anims/orb-red.webp", "/anims/orb-pearl.webp"];

// `special`: a pearl — the bonus balls, with a rainbow sheen.
type Ball = { body: MatterNS.Body; look: number; emoji: number; special: boolean };
const PEARL_CHANCE = 1 / 6;
// What a won ball turns out to be: points (an emoji prize), a bomb that
// knocks points off, an extra try — or the rare ones: a skull (game over on
// the spot) and a super bonus that blasts a few balls out of the pile for
// their points.
export type Prize =
  | { kind: "points"; points: number }
  | { kind: "jackpot"; points: number }
  | { kind: "bomb"; points: number }
  | { kind: "try" }
  | { kind: "death" }
  | { kind: "blast"; count: number; points: number }
  | { kind: "golden" } // next points prize doubled
  | { kind: "magnet" } // next grab reaches twice as far
  | { kind: "iron" } // next catch can't slip out
  | { kind: "sticky" } // next grab can pick up a couple of extra balls
  | { kind: "slow" } // claw slows down for the next 2 drops
  | { kind: "shake" } // the pile jumps and reshuffles
  | { kind: "sneaky" } // a decoy — nothing inside
  | { kind: "mystery"; inside: Prize[] }; // points + a power-up

// The icon and words a prize pops open with.
function prizeLook(p: Prize): { icon: string; text: string } {
  switch (p.kind) {
    case "points":
      return { icon: "", text: `+${p.points}` };
    case "jackpot":
      return { icon: "🎰", text: `+${p.points}!` };
    case "bomb":
      return { icon: "💣", text: `−${p.points}` };
    case "try":
      return { icon: "❤️", text: "+1 try" };
    case "death":
      return { icon: "💀", text: "Game over!" };
    case "blast":
      return { icon: "💥", text: `+${p.points}` };
    case "golden":
      return { icon: "⭐", text: "Next one ×2!" };
    case "magnet":
      return { icon: "🧲", text: "Magnet grab next!" };
    case "slow":
      return { icon: "🐌", text: "Slow-mo!" };
    case "iron":
      return { icon: "🦾", text: "Iron claw next!" };
    case "sticky":
      return { icon: "🍯", text: "Sticky claw next!" };
    case "shake":
      return { icon: "🌪️", text: "Shake-up!" };
    case "sneaky":
      return { icon: "👻", text: "Sneaky! Nothing!" };
    case "mystery":
      return { icon: "🎁", text: p.inside.map((q) => prizeLook(q).text).join(" & ") };
  }
}
type State = "roam" | "down" | "grab" | "up" | "carry" | "release" | "prize";
type Images = {
  parts: Record<keyof typeof ART, HTMLImageElement | null>;
  balls: (HTMLImageElement | HTMLCanvasElement)[]; // the colored ones
  pearl: HTMLImageElement | null;
  emojis: (HTMLImageElement | null)[];
  platform: HTMLImageElement | null; // the block-stack platform, for the floor and chute wall
};

async function loadImages(): Promise<Images> {
  const keys = Object.keys(ART) as (keyof typeof ART)[];
  const [parts, red, pearl, emojis, platform] = await Promise.all([
    Promise.all(keys.map((k) => loadImage(ART[k].src))),
    loadImage(BALL_SRCS[0]),
    loadImage(BALL_SRCS[1]),
    Promise.all(EMOJI_SOURCES.map((s) => loadImage(s))),
    loadImage("/anims/platform.webp"),
  ]);
  const balls: (HTMLImageElement | HTMLCanvasElement)[] = [];
  if (red) for (const t of TINTS) balls.push(tinted(red, t));
  return { parts: Object.fromEntries(keys.map((k, i) => [k, parts[i]])) as Images["parts"], balls, pearl, emojis, platform };
}

// The platform art as a bar of any length without stretching its rounded
// ends: the ends keep their shape and only the middle stretches. Drawn
// along +x from (x, y) at the given thickness; rotate the canvas for a
// vertical bar.
function drawBar(ctx: CanvasRenderingContext2D, art: HTMLImageElement, x: number, y: number, length: number, thick: number) {
  const sw = art.naturalWidth;
  const sh = art.naturalHeight;
  const cap = sh * 0.55; // the rounded end, in art px
  const dc = Math.min(cap * (thick / sh), length / 2); // on screen
  ctx.drawImage(art, 0, 0, cap, sh, x, y, dc, thick);
  ctx.drawImage(art, cap, 0, sw - cap * 2, sh, x + dc - 0.5, y, length - dc * 2 + 1, thick);
  ctx.drawImage(art, sw - cap, 0, cap, sh, x + length - dc, y, dc, thick);
}

const sparkle = (x: number, y: number, count = 28) =>
  confetti({
    ...confettiStyle(),
    particleCount: count,
    spread: 360,
    startVelocity: count > 28 ? 26 : 16,
    ticks: 60,
    origin: { x: x / window.innerWidth, y: y / window.innerHeight },
  });

// The machine, shared by the celebration and the game. `prize()` is asked
// what each ball won turns out to be (null = nothing more to win).
async function createClaw(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  area: Area,
  prize: (special: boolean) => Prize | null,
  onWon: (prize: Prize) => void,
) {
  const M = await loadMatter();
  const img = await loadImages();
  const k = Math.min(0.42, W / 890); // art px → screen px
  const r = BALL_RADIUS * k;
  // The floor is a platform bar along the bottom; balls sit on top of it.
  const barT = Math.max(14, r * 0.5);
  const floorY = area.y + area.h - barT;
  const wallT = barT * 0.8; // the chute wall
  // The chute is wide enough that the claw can sit over it without an arm
  // running off the screen.
  const clawHalf = CLAW_HALF_WIDTH * k;
  const chuteW = Math.max(r * 3.4, clawHalf + r + 12);
  const chuteX = Math.max(area.x + chuteW / 2, area.x + clawHalf);
  const pileLeft = area.x + chuteW;
  const topY = area.y; // the head's top at rest is the rod's length below this
  const restRod = 8;

  const engine = M.Engine.create({ gravity: { x: 0, y: 1, scale: 0.0012 } });
  const wall = (x: number, y: number, w: number, h: number) =>
    M.Bodies.rectangle(x, y, w, h, { isStatic: true, friction: 0.6 });
  M.Composite.add(engine.world, [
    wall(area.x + area.w / 2, floorY + 20, area.w + 200, 40), // floor
    wall(area.x + area.w + 20, area.y + area.h / 2, 40, area.h * 2), // right wall
    wall(pileLeft, floorY - 40, wallT, 80), // chute divider
  ]);

  const balls: Ball[] = [];
  let looks = 0;
  const addBall = (x: number, y: number) => {
    const body = M.Bodies.circle(x, y, r, { friction: 0.4, restitution: 0.2, density: 0.002, frictionAir: 0.01 });
    M.Composite.add(engine.world, body);
    balls.push({
      body,
      look: looks++ % Math.max(1, img.balls.length),
      emoji: Math.floor(Math.random() * EMOJI_SOURCES.length),
      special: Math.random() < PEARL_CHANCE,
    });
  };
  // Balls never start overlapping (overlaps make the physics shove them
  // apart — balls flying everywhere).
  const left = pileLeft + r + 4;
  const right = area.x + area.w - r - 4;
  // The starting pile: neat staggered rows from the floor up, a little
  // jitter, then let it settle before anyone sees it.
  const startPile = (count: number) => {
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / across);
      const col = i % across;
      const bx = Math.min(right, left + col * r * 2.1 + (row % 2) * r + rand(-2, 2));
      addBall(bx, floorY - r - 2 - row * r * 1.95);
    }
  };
  // A refill drops in at a free spot near the top (none free: try later).
  const dropIn = () => {
    const y = area.y + area.h * 0.35;
    for (let tries = 0; tries < 6; tries++) {
      const bx = rand(left, right);
      if (Math.abs(bx - x) < clawHalf + r) continue;
      if (balls.every((b) => Math.hypot(b.body.position.x - bx, b.body.position.y - y) > r * 2.3)) {
        addBall(bx, y);
        return;
      }
    }
  };
  // Safety net: nothing ever moves faster than this.
  const MAX_SPEED = 18;
  const calm = () => {
    for (const b of balls)
      if (b.body.speed > MAX_SPEED) {
        const v = b.body.velocity;
        const f = MAX_SPEED / b.body.speed;
        M.Body.setVelocity(b.body, { x: v.x * f, y: v.y * f });
      }
  };
  // Two rows' worth for the screen width (about 10 on a phone, up to 18).
  const across = Math.max(1, Math.floor((right - left) / (r * 2.1)) + 1);
  startPile(Math.max(8, Math.min(18, across * 2)));
  for (let i = 0; i < 360; i++) {
    M.Engine.update(engine, 1000 / 60);
    calm();
  }

  // The claw.
  let state: State = "roam";
  let x = area.x + area.w * 0.6;
  let dir = 1;
  let rod = restRod;
  let open = 0.15; // arm swing (radians)
  let timer = 0;
  let held: Ball | null = null;
  // Where a just-caught ball was, relative to the claw — it slides into
  // place instead of jumping.
  let heldFrom = { x: 0, y: 0 };
  let slipAt = -1; // rod length at which a caught ball slips out (-1 = it won't)
  let dropping: { y: number; vy: number; ball: Ball } | null = null;
  // Sticky claw: extra balls stuck to the outside of the arms (offsets from
  // the grab point), and the balls still to drop into the chute.
  let stuck: { ball: Ball; ox: number; oy: number }[] = [];
  let toDrop: Ball[] = [];
  let shown: { ball: Ball; prize: Prize; t: number } | null = null;
  let roamSpeed = 120;

  // The motor whirr while the claw glides — only now and then (and never
  // back to back), not all the time.
  let whirrIn = rand(2, 5);
  let lastWhirr = -10;
  const whirr = (chance: number) => {
    const now = performance.now() / 1000;
    if (now - lastWhirr < 2 || Math.random() > chance) return;
    lastWhirr = now;
    void playSound("clawMove");
  };

  const headTop = () => topY + rod;
  const hingeY = () => headTop() + HINGE.y * k;

  // Sway: the claw swings on its rod like a pendulum, pushed by its own
  // moves (it lags when it starts or turns, then swings back). Grabs line
  // up with where it has swung to, not where the rod starts.
  let sway = 0; // radians, + = swung right
  let swayV = 0;
  let lastX = x;
  const anchor = () => ({ x, y: -10 }); // where the rod hangs from
  // A point on the unswung claw, moved to where the swing has taken it.
  const swung = (p: { x: number; y: number }) => {
    const a = anchor();
    const dx = p.x - a.x;
    const dy = p.y - a.y;
    const c = Math.cos(-sway);
    const sn = Math.sin(-sway);
    return { x: a.x + dx * c - dy * sn, y: a.y + dx * sn + dy * c };
  };
  const grabPoint = () => swung({ x, y: hingeY() + GRAB_BELOW_HINGE * k });

  // The arm tips are solid: on the way down they shove the balls beside
  // the claw out of the way (the one lined up between them isn't pushed).
  // Parked off-screen while the claw is up at the top.
  const tipR = r * 0.35;
  const tips = [-1, 1].map(() => M.Bodies.circle(-500, -500, tipR, { isStatic: true, friction: 0.1 }));
  M.Composite.add(engine.world, tips);
  // Moved by hand with their velocity filled in, so they push (see stack.ts).
  const setPosition = M.Body.setPosition as (b: MatterNS.Body, p: MatterNS.Vector, updateVelocity?: boolean) => void;
  let tipsLow = false;
  const placeTips = () => {
    const low = state === "down" || state === "grab" || state === "up";
    const g = grabPoint();
    void g;
    tips.forEach((tip, i) => {
      const side = i === 0 ? -1 : 1;
      // The fingertip, swung open around the hinge.
      const dx = side * TIP_OUT * k;
      const dy = TIP_BELOW_HINGE * k;
      const a = -side * open;
      const tipAt = swung({ x: x + dx * Math.cos(a) - dy * Math.sin(a), y: hingeY() + dx * Math.sin(a) + dy * Math.cos(a) });
      const at = low ? tipAt : { x: -500 - i * 50, y: -500 };
      // Only carry speed while they're moving with the claw — not on the
      // jump in from (or out to) the parking spot.
      setPosition(tip, at, low && tipsLow);
    });
    tipsLow = low;
  };

  // Shake-up: the whole pile jumps and lands somewhere new.
  const shake = () => {
    void playSound("thud");
    for (const b of balls) M.Body.setVelocity(b.body, { x: rand(-6, 6), y: rand(-14, -8) });
  };
  let magnet = false; // the next grab reaches twice as far
  let iron = false; // the next catch can't slip
  let sticky = false; // the next grab picks up extra balls touching the claw
  let badges: string[] = []; // little icons for what's active (⭐ 🧲 🐌)

  // Super bonus: a few balls in the pile burst, one after another.
  const blast = (count: number) => {
    void playSound("boom");
    const picks = [...balls].sort(() => Math.random() - 0.5).slice(0, count);
    picks.forEach((b, i) =>
      setTimeout(() => {
        const at = balls.indexOf(b);
        if (at < 0) return;
        balls.splice(at, 1);
        M.Composite.remove(engine.world, b.body);
        sparkle(b.body.position.x, b.body.position.y);
        void playSound("pop");
      }, 150 + i * 220),
    );
  };

  let doomed: Ball | null = null; // about to be blown up by a bomb
  // Bomb: it takes out one of the pearls in the pile and the blast throws
  // the whole pile around — which can bury good balls or dig them out.
  const bombPearl = () => {
    // A pearl if there is one, otherwise any ball — it flashes red first so
    // you can see which one's going.
    const pearls = balls.filter((b) => b.special);
    const pool = pearls.length ? pearls : balls;
    const b = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
    doomed = b;
    setTimeout(() => {
      doomed = null;
      // Blast from the pearl, or from the middle of the pile if none are left.
      const at = b ? { ...b.body.position } : { x: pileLeft + (W - pileLeft) / 2, y: floorY - r };
      if (b && balls.includes(b)) {
        balls.splice(balls.indexOf(b), 1);
        M.Composite.remove(engine.world, b.body);
        sparkle(at.x, at.y, 70);
      }
      for (const o of balls) {
        const dx = o.body.position.x - at.x;
        const dy = o.body.position.y - at.y;
        const d = Math.max(1, Math.hypot(dx, dy));
        const push = 6 + 10 * Math.max(0, 1 - d / (r * 8)); // harder up close
        M.Body.setVelocity(o.body, {
          x: (dx / d) * push + rand(-3, 3),
          y: Math.min(-4, (dy / d) * push) - rand(4, 9), // everything goes up
        });
      }
      void playSound("explode");
    }, 700);
  };

  const drop = () => {
    if (state !== "roam") return false;
    state = "down";
    void playSound("clawDown");
    return true;
  };

  const step = (dt: number, speedUp = 0) => {
    roamSpeed = 120 + speedUp;
    const ms = Math.min(dt, 1 / 20) * 1000;
    if (ms > 0) {
      placeTips();
      M.Engine.update(engine, ms / 2);
      calm();
      M.Engine.update(engine, ms / 2);
      calm();
    }
    // Swing: the claw lags behind the way it's moving, then swings back.
    if (dt > 0) {
      const vx = (x - lastX) / dt;
      lastX = x;
      const want = -vx * 0.0005;
      swayV += (-40 * (sway - want) - 2.5 * swayV) * dt;
      sway = Math.max(-0.25, Math.min(0.25, sway + swayV * dt));
    }
    const g = grabPoint();
    switch (state) {
      case "roam": {
        open += (0.15 - open) * Math.min(1, dt * 6);
        if ((whirrIn -= dt) <= 0) {
          whirr(0.5);
          whirrIn = rand(4, 9);
        }
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
          balls.some((b) => Math.abs(b.body.position.x - g.x) < r * 1.2 && b.body.position.y - g.y < r * 0.6);
        if (blocked) {
          state = "grab";
          timer = 0;
          void playSound("clawOpen"); // the joint whirr as it closes
        }
        break;
      }
      case "grab": {
        timer += dt;
        open = 0.55 * Math.max(0, 1 - timer / 0.35);
        if (timer >= 0.35) {
          // Only a ball lined up under the claw gets caught: within about
          // half a ball's width of center (wider with the 🧲 magnet). Off to
          // the side is just a miss — and once caught, it stays caught.
          // A 🍯 sticky claw catches whatever it's touching.
          const reach = sticky ? clawHalf * 0.6 : r * (magnet ? 1.1 : 0.55);
          const near = balls
            .filter((b) => Math.abs(b.body.position.x - g.x) < reach && Math.abs(b.body.position.y - g.y) < r * 1.2)
            .sort((a, b) => Math.abs(a.body.position.x - g.x) - Math.abs(b.body.position.x - g.x))[0];
          const take = (b: Ball) => {
            M.Composite.remove(engine.world, b.body);
            balls.splice(balls.indexOf(b), 1);
          };
          if (near) {
            held = near;
            heldFrom = { x: near.body.position.x - g.x, y: near.body.position.y - g.y };
            take(near);
            // It can still slip out on the way up — more likely if it was
            // caught off-center — unless it's an iron (or sticky) claw.
            const off = Math.abs(heldFrom.x) / r;
            slipAt = !iron && !sticky && Math.random() < 0.12 + off * 0.45 ? rod * rand(0.3, 0.75) : -1;
          }
          // Sticky: the two closest other balls around the claw (beside the
          // arms, or a row or two down the pile) come along stuck to the outside of
          // the arms — one each side when it can.
          if (sticky && held) {
            const touching = balls
              .map((b) => ({ b, dx: b.body.position.x - g.x, dy: b.body.position.y - g.y }))
              .filter((n) => Math.abs(n.dx) < clawHalf + r && n.dy > -r * 2.5 && n.dy < r * 4.5)
              .sort((a, b) => Math.hypot(a.dx, a.dy) - Math.hypot(b.dx, b.dy));
            const first = touching[0];
            const second = first && (touching.find((n) => n !== first && Math.sign(n.dx) !== Math.sign(first.dx)) ?? touching[1]);
            const sides: number[] = [];
            for (const n of [first, second]) {
              if (!n) continue;
              let side = n.dx < 0 ? -1 : 1;
              if (sides.includes(side) && !sides.includes(-side)) side = -side; // keep it balanced
              const below = sides.filter((s2) => s2 === side).length; // stack if both one side
              sides.push(side);
              stuck.push({ ball: n.b, ox: side * r * 1.75, oy: r * (0.25 + below * 1.1) });
              take(n.b);
            }
          }
          magnet = false;
          iron = false;
          sticky = false;
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
          M.Body.setVelocity(b.body, { x: swayV * 2, y: 0 });
          M.Composite.add(engine.world, b.body);
          balls.push(b);
          // "Whoopsie!" and an "aww" together.
          void playSound("whoops");
          void playSound("aww");
        }
        if (rod <= restRod) {
          state = held ? "carry" : "roam";
          if (held) whirr(0.7);
        }
        break;
      }
      case "carry": {
        x = Math.max(chuteX, x - 220 * dt);
        if (x <= chuteX) {
          state = "release";
          timer = 0;
          void playSound("clawOpen");
        }
        break;
      }
      case "release": {
        timer += dt;
        open += (0.55 - open) * Math.min(1, dt * 8);
        if (held && timer > 0.15) {
          toDrop = [held, ...stuck.map((s) => s.ball)];
          held = null;
          stuck = [];
        }
        // One ball at a time into the chute, each its own prize.
        if (!dropping && toDrop.length) dropping = { y: g.y, vy: 0, ball: toDrop.shift()! };
        if (dropping) {
          dropping.vy += 1600 * dt;
          dropping.y += dropping.vy * dt;
          if (dropping.y > floorY - r) {
            const won = prize(dropping.ball.special);
            const ball = dropping.ball;
            dropping = null;
            if (won) {
              shown = { ball, prize: won, t: 0 };
              if (won.kind === "bomb" || won.kind === "death") {
                void playSound("boom");
                if (won.kind === "bomb") bombPearl();
              }
              else if (won.kind === "blast") blast(won.count);
              else if (won.kind === "shake") shake();
              else if (won.kind === "sneaky") void playSound("pop");
              else {
                sparkle(chuteX, floorY - r * 2);
                void playSound("pop");
              }
              onWon(won);
            }
            if (!toDrop.length) {
              state = "prize";
              timer = 0;
            }
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
    // A ball that bounces over into the chute can't be grabbed — clear it.
    for (let i = balls.length - 1; i >= 0; i--) {
      if (balls[i].body.position.x < pileLeft - r * 0.3) {
        M.Composite.remove(engine.world, balls[i].body);
        balls.splice(i, 1);
      }
    }
    // Only if the pile is nearly gone does a ball drop in — away from the claw.
    if (balls.length + (held ? 1 : 0) + toDrop.length + (dropping ? 1 : 0) < 3) dropIn();
  };

  const drawBall = (b: Ball, bx: number, by: number, angle = 0) => {
    const src = b.special && img.pearl ? img.pearl : img.balls[b.look % Math.max(1, img.balls.length)];
    const time = performance.now() / 1000;
    ctx.save();
    ctx.translate(bx, by);
    if (b.special) {
      // A soft pulsing glow…
      ctx.shadowColor = color("party-yellow", 0.9);
      ctx.shadowBlur = 10 + Math.sin(time * 4 + b.emoji) * 5;
    }
    ctx.save();
    ctx.rotate(angle);
    if (src) ctx.drawImage(src, -r, -r, r * 2, r * 2);
    else {
      ctx.fillStyle = color("party-pink");
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (b.special) {
      // …and a rainbow sheen sweeping across it.
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.clip();
      const sweep = ((time * 0.7 + b.emoji * 0.13) % 1) * r * 5 - r * 2.5;
      const sheen = ctx.createLinearGradient(sweep - r, -r, sweep + r, r);
      sheen.addColorStop(0, color("party-pink", 0));
      sheen.addColorStop(0.3, color("party-pink", 0.55));
      sheen.addColorStop(0.5, color("party-cyan", 0.6));
      sheen.addColorStop(0.7, color("party-yellow", 0.55));
      sheen.addColorStop(1, color("party-yellow", 0));
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = sheen;
      ctx.fillRect(-r, -r, r * 2, r * 2);
    }
    ctx.restore();
  };

  const part = (key: keyof typeof ART, dx: number, dy: number, w = ART[key].w * k, h = ART[key].h * k) => {
    const i = img.parts[key];
    if (i) ctx.drawImage(i, dx, dy, w, h);
  };

  const draw = (time: number) => {
    ctx.clearRect(0, 0, W, H);
    // Prize chute.
    ctx.fillStyle = color("primary", 0.12);
    ctx.beginPath();
    ctx.roundRect(area.x, floorY - 80, chuteW - 6, 80, [16, 16, 0, 0]);
    ctx.fill();
    // Chute wall and floor, drawn with the platform art.
    if (img.platform) {
      ctx.save();
      ctx.translate(pileLeft + wallT / 2, floorY - 80);
      ctx.rotate(Math.PI / 2);
      drawBar(ctx, img.platform, 0, 0, 80 + barT / 2, wallT);
      ctx.restore();
      drawBar(ctx, img.platform, area.x, floorY, area.w, barT);
    } else {
      ctx.fillStyle = color("primary", 0.25);
      ctx.beginPath();
      ctx.roundRect(pileLeft - wallT / 2, floorY - 80, wallT, 80, wallT / 2);
      ctx.roundRect(area.x, floorY, area.w, barT, barT / 2);
      ctx.fill();
    }

    for (const b of balls) drawBall(b, b.body.position.x, b.body.position.y, b.body.angle);
    if (doomed) {
      // Drawn over the pile so a buried one still shows: a pulsing red glow.
      const { x: dx, y: dy } = doomed.body.position;
      drawBall(doomed, dx, dy, doomed.body.angle);
      ctx.save();
      ctx.fillStyle = `rgba(255, 40, 40, ${0.35 + 0.3 * Math.abs(Math.sin(time * 18))})`;
      ctx.strokeStyle = "rgba(255, 40, 40, 0.9)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(dx, dy, r * 1.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    if (dropping) drawBall(dropping.ball, chuteX, dropping.y);

    // The claw, hanging from the top of the screen: rod (tucked into the
    // head's top), head, a held ball, then the arms over the hinge.
    const top = headTop();
    ctx.save();
    const a = anchor();
    ctx.translate(a.x, a.y);
    ctx.rotate(-sway);
    ctx.translate(-a.x, -a.y);
    part("rod", x - (ART.rod.w * k) / 2, -10, ART.rod.w * k, top + 18);
    part("head", x - HINGE.x * k, top);
    // (Inside the swing, so drawn at the unswung spot.)
    const g = { x, y: hingeY() + GRAB_BELOW_HINGE * k };
    // A loose grip: while it's holding a ball, the ball jiggles and sags a
    // little and the arms twitch — about twice as much when it's going to
    // slip (a tell for sharp eyes).
    const loose = held ? (slipAt > 0 ? 1 : 0.45) : 0;
    if (held) {
      for (const s of stuck) drawBall(s.ball, g.x + s.ox, g.y + s.oy);
      heldFrom.x *= 0.82;
      heldFrom.y *= 0.82;
      const jx = (Math.sin(time * 19) + Math.sin(time * 31) * 0.6) * r * 0.07 * loose;
      const jy = (Math.abs(Math.sin(time * 13)) * 0.6 + 0.4) * r * 0.08 * loose;
      drawBall(held, g.x + heldFrom.x + jx, g.y + heldFrom.y + jy);
    }
    const twitch = (Math.sin(time * 23) * 0.05 + Math.sin(time * 37) * 0.03) * loose + 0.04 * loose;
    const wobble = (state === "roam" ? Math.sin(time * 4) * 0.03 : 0) + twitch;
    for (const [key, hinge, swing] of [
      ["left", LEFT_HINGE, open + wobble],
      ["right", RIGHT_HINGE, -open - wobble],
    ] as const) {
      ctx.save();
      ctx.translate(x, hingeY());
      ctx.rotate(swing);
      part(key, -hinge.x * k, -hinge.y * k);
      ctx.restore();
    }
    ctx.restore(); // the swing

    // A won ball pops open: its emoji and the points.
    if (shown) {
      const p = Math.min(1, shown.t / 0.3);
      const y = floorY - r * 3.5 - shown.t * 40;
      const size = r * 3.6 * (0.4 + p * 0.6);
      ctx.save();
      ctx.globalAlpha = shown.t > 1.2 ? Math.max(0, 1 - (shown.t - 1.2) / 0.4) : 1;
      const won = shown.prize;
      if (won.kind === "points") {
        const e = img.emojis[shown.ball.emoji];
        if (e) ctx.drawImage(e, chuteX - size / 2, y - size, size, size);
      } else {
        ctx.font = `${Math.round(size * 0.8)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(prizeLook(won).icon, chuteX, y - size * 0.15);
      }
      // Words can be long ("Can't miss next!"), so keep them on screen.
      ctx.save();
      ctx.font = "900 26px system-ui, sans-serif";
      const text = prizeLook(won).text;
      const half = ctx.measureText(text).width / 2 + 8;
      ctx.restore();
      const tx = Math.max(area.x + half, Math.min(area.x + area.w - half, chuteX + size * 0.6));
      drawLabel(ctx, text, tx, y - size * 0.85, 26);
      ctx.restore();
    }
    // What's active, by the rail's right end.
    if (badges.length) {
      ctx.save();
      ctx.font = "22px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillText(badges.join(" "), area.x + area.w, area.y + 4);
      ctx.restore();
    }
  };

  return {
    step,
    draw,
    drop,
    busy: () => state !== "roam",
    setMagnet: () => (magnet = true),
    setIron: () => (iron = true),
    setSticky: () => (sticky = true),
    setBadges: (b: string[]) => (badges = b),
    stop: () => M.Engine.clear(engine),
  };
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
    () => (prizes.length ? { kind: "points", points: prizes.shift()! } : null), // pearls hold the same here
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

// Dev panel for trying out the specials without hunting for them (local
// dev server only — never in a deployed build): add ?dev to the page URL (it's remembered on this device; ?dev=0 turns it off).
function devMode(): boolean {
  try {
    const q = new URLSearchParams(window.location.search).get("dev");
    if (q !== null) localStorage.setItem("pp:dev", q === "0" ? "" : "1");
    return localStorage.getItem("pp:dev") === "1";
  } catch {
    return false;
  }
}

// On the page itself, above the score bar (which would swallow the taps).
function devPanel(safe: { x: number; y: number }, now: (p: Prize) => void, next: (p: Prize) => void): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "fixed z-[90] flex flex-col gap-1 rounded-2xl bg-white/90 p-2 text-xs font-bold text-pp-primary shadow-sm";
  panel.style.left = `${safe.x + 8}px`;
  panel.style.top = `${safe.y + 8}px`;
  panel.style.pointerEvents = "auto";
  panel.style.maxWidth = "calc(100vw - 160px)";
  const status = document.createElement("div");
  const row = (label: string, items: [string, Prize][], act: (p: Prize) => void, say: (icon: string) => string) => {
    const wrap = document.createElement("div");
    wrap.className = "flex flex-wrap items-center gap-1";
    const title = document.createElement("span");
    title.textContent = label;
    title.className = "mr-1";
    wrap.appendChild(title);
    for (const [icon, p] of items) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = icon;
      b.title = prizeLook(p).text;
      b.className = "h-8 w-8 rounded-full bg-pp-soft text-base";
      b.onclick = () => {
        act(p);
        status.textContent = say(icon);
      };
      wrap.appendChild(b);
    }
    panel.appendChild(wrap);
  };
  row(
    "Now",
    [
      ["🍯", { kind: "sticky" }],
      ["🦾", { kind: "iron" }],
      ["🧲", { kind: "magnet" }],
      ["⭐", { kind: "golden" }],
      ["🐌", { kind: "slow" }],
      ["❤️", { kind: "try" }],
    ],
    now,
    (icon) => `${icon} on for the next drop`,
  );
  row(
    "Next ball",
    [
      ["💣", { kind: "bomb", points: 3 }],
      ["💀", { kind: "death" }],
      ["🌪️", { kind: "shake" }],
      ["💥", { kind: "blast", count: 3, points: 6 }],
      ["🎰", { kind: "jackpot", points: 15 }],
      ["🎁", { kind: "mystery", inside: [{ kind: "points", points: 2 }, { kind: "sticky" }] }],
      ["👻", { kind: "sneaky" }],
    ],
    next,
    (icon) => `Next ball you win: ${icon}`,
  );
  status.className = "text-pp-muted";
  status.textContent = "Dev mode";
  panel.appendChild(status);
  document.body.appendChild(panel);
  return panel;
}

// "Keep playing": five tries. Each ball won pops open into something — see
// `Prize`. Colored balls are mostly points (1–5, bigger ones rarer) with
// bombs, sneaky decoys, shake-ups and the odd skull mixed in; the shiny
// pearls are always good (jackpot, super bonus, golden, magnet, iron
// claw, sticky claw, slow-mo, an extra try or a mystery box). The claw speeds up as you
// go; the game's over when the tries run out (or a skull turns up).
const TRIES = 5;
export function playClawGame(opts: GameOptions): () => void {
  const { layer, ctx, W, H, safe } = createCanvasGame("game");
  let score = 0;
  let tries = TRIES;
  let drops = 0;
  let over = false;
  // Specials waiting for later grabs.
  let golden = false;
  let slowDrops = 0;
  let magnetOn = false;
  let ironOn = false;
  let stickyOn = false;
  opts.onLives?.(tries);
  let stop = () => layer.remove();
  const hint = hintBubble(layer, "Tap to drop the claw!", safe.y + safe.h * 0.42);

  const basic = (): Prize => {
    const p = Math.random();
    return { kind: "points", points: p < 0.5 ? 1 : p < 0.75 ? 2 : p < 0.9 ? 3 : 5 };
  };
  const pick = (table: [number, () => Prize][], rest: () => Prize): Prize => {
    const r = Math.random();
    let acc = 0;
    for (const [chance, make] of table) if (r < (acc += chance)) return make();
    return rest();
  };
  // Colored balls: mostly points, with the risky ones mixed in.
  const regular = (): Prize =>
    pick(
      [
        [0.04, () => ({ kind: "death" })],
        [0.16, () => ({ kind: "bomb", points: 3 })],
        [0.08, () => ({ kind: "try" })],
        [0.06, () => ({ kind: "shake" })],
        [0.06, () => ({ kind: "sneaky" })],
      ],
      basic,
    );
  // Pearls: always something good.
  const bonus = (): Prize =>
    pick(
      [
        [0.1, () => ({ kind: "jackpot", points: 15 })],
        [0.11, () => ({ kind: "iron" })],
        [0.07, () => ({ kind: "sticky" })],
        [0.15, () => {
          const each = Array.from({ length: 3 }, () => 1 + Math.floor(Math.random() * 4));
          return { kind: "blast", count: 3, points: each.reduce((a, b) => a + b, 0) };
        }],
        [0.13, () => ({ kind: "golden" })],
        [0.12, () => ({ kind: "magnet" })],
        [0.1, () => ({ kind: "slow" })],
        [0.12, () => ({ kind: "try" })],
      ],
      // Mystery box: some points plus a random power-up.
      () => {
        const powerUps: Prize[] = [
          { kind: "try" },
          { kind: "golden" },
          { kind: "magnet" },
          { kind: "iron" },
          { kind: "slow" },
          { kind: "sticky" },
        ];
        return { kind: "mystery", inside: [basic(), powerUps[Math.floor(Math.random() * powerUps.length)]] };
      },
    );
  let forced: Prize | null = null; // dev panel: what the next ball turns out to be
  const roll = (special: boolean) => {
    const next = forced;
    forced = null;
    return next ?? (special ? bonus() : regular());
  };
  // ⭐ doubles the next points prize (shown doubled when it pops open).
  const prize = (special: boolean): Prize => {
    const won = roll(special);
    const double = (p: Prize): Prize => (p.kind === "points" || p.kind === "jackpot" ? { ...p, points: p.points * 2 } : p);
    if (golden && (won.kind === "points" || won.kind === "jackpot")) {
      golden = false;
      return double(won);
    }
    return won;
  };

  let machine: Awaited<ReturnType<typeof createClaw>> | null = null;
  const badges = () =>
    machine?.setBadges(
      [golden ? "⭐" : "", magnetOn ? "🧲" : "", ironOn ? "🦾" : "", stickyOn ? "🍯" : "", slowDrops > 0 ? `🐌${slowDrops}` : ""].filter(Boolean),
    );
  const apply = (won: Prize) => {
    switch (won.kind) {
      case "points":
      case "jackpot":
      case "blast":
        opts.onScore((score += won.points));
        break;
      case "bomb":
        opts.onScore((score = Math.max(0, score - won.points)));
        break;
      case "try":
        // The try that won it comes back, plus one more — so you end up
        // with a heart more than before you dropped.
        opts.onLives?.((tries += 2));
        break;
      case "death":
        opts.onLives?.((tries = 0));
        break;
      case "golden":
        golden = true;
        break;
      case "magnet":
        magnetOn = true;
        machine?.setMagnet();
        break;
      case "slow":
        slowDrops = 2;
        break;
      case "iron":
        ironOn = true;
        machine?.setIron();
        break;
      case "sticky":
        stickyOn = true;
        machine?.setSticky();
        break;
      case "mystery":
        won.inside.forEach(apply);
        break;
    }
    badges();
  };

  void createClaw(ctx, W, H, safe, prize, apply).then((m) => {
    machine = m;
    // Local dev server only: the check is compiled away in deployed builds,
    // taking the panel with it.
    const dev =
      process.env.NODE_ENV === "development" && devMode() ? devPanel(safe, apply, (p) => (forced = p)) : null;
    gameInput({
      down: () => {
        hint.remove();
        if (over || tries <= 0) return;
        if (m.drop()) {
          drops++;
          opts.onLives?.(--tries);
          magnetOn = false; // used up by this grab
          ironOn = false;
          stickyOn = false;
          if (slowDrops > 0) slowDrops--;
          badges();
        }
      },
    });
    runLoop(layer, (dt, time) => {
      // 🐌 slows the claw right down while it lasts (counted per drop).
      m.step(dt, slowDrops > 0 ? -70 : Math.min(80, drops * 10));
      m.draw(time);
      // Out of tries once the last one has played out.
      if (!over && tries <= 0 && !m.busy()) {
        over = true;
        opts.onGameOver?.();
      }
    });
    const prev = stop;
    stop = () => {
      m.stop();
      dev?.remove();
      prev();
    };
  });
  onStop(() => stop());
  return () => stop();
}
