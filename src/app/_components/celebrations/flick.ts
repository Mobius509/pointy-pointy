import confetti from "canvas-confetti";
import { color, createCanvasGame, drawLabel, gameInput, loadImage, pointChunks, rand, runLoop, type Area } from "./canvasGame";
import { confettiStyle, fadeOutLayer, hintBubble, onStop, type CelebrationOptions, type GameOptions } from "./shared";
import { playSound } from "./sounds";

// Flick shot, like a skee-ball lane: flick the ball up the lane — the
// flick's direction aims it and its speed sets how far it rolls (twice as
// hard, about twice as far). It slows as it rolls up, bounces off the sides,
// and drops into a hole where it runs out of steam — going up, or rolling
// back down. A hard one bounces off the back wall and comes back down. The
// holes slide side to side; big ones in front, small high-scoring ones at
// the back.
const BALL_SRC = "/anims/orb-red.webp";

const TUNE = {
  slope: 0.9, // how hard the lane pulls the ball back down, × screen height per s²
  // The flick → how far the ball rolls, as a share of the way to the back:
  flickSoft: 300, // px/s: the gentlest flick that counts…
  flickFirm: 2650, // …and a firm one, which just reaches the back
  reachSoft: 0.35, // the gentlest flick rolls this far (short of the front hole)…
  reachMax: 1.25, // …and the hardest hits the back wall this hard (as a share of just reaching it)
  backBounce: 0.8, // the back wall sends the ball back with this much of its speed
  flickWindow: 150, // ms of the swipe that set the flick (evens out wobbles)
  // A hole catches a ball that's running out of steam over it: slower than
  // this share of a back-hole roll's speed, more for a bigger hole — so the
  // ball drops in about where it stops, and a big front hole catches over a
  // longer stretch (easier) without stealing balls headed for the back.
  sink: 0.1,
  sinkPerSize: 1.6, // + this × the hole's size (its share of the lane width)
  // Rolling back down over a hole, it drops in whatever its speed if it
  // overlaps the hole by enough of itself: a quarter for the biggest hole,
  // up to nearly a direct hit for the smallest.
  overlapBig: 0.25,
  overlapSmall: 0.85,
  holeSlide: 0.06, // how fast the holes slide, × lane width per second…
  holeSlideUp: 0.004, // …faster by this much per point scored (in the game)
  holeSlideMax: 0.22,
  balls: 10, // in a game
};

// The holes, top to bottom: value, size (× lane width), height (× lane
// height from the top), and how far they slide.
const HOLES = [
  { value: 100, size: 0.06, at: 0.08, slide: 0.32 },
  { value: 50, size: 0.07, at: 0.2, slide: 0.18, x: -0.24 },
  { value: 50, size: 0.07, at: 0.2, slide: 0.18, x: 0.24 },
  { value: 30, size: 0.085, at: 0.33, slide: 0.3 },
  { value: 20, size: 0.1, at: 0.45, slide: 0.28 },
  { value: 10, size: 0.13, at: 0.57, slide: 0.22 },
];
const RING = ["party-yellow", "party-pink", "party-pink", "party-cyan", "accent", "primary"];

type Hole = {
  value: number;
  r: number;
  y: number;
  baseX: number;
  amp: number;
  phase: number;
  x: number;
  catchSpeed: number; // going up, catches a ball slower than this…
  catchDown: number; // …and rolling back down, one whose center is closer than this (any speed)
  label?: number;
  ring: string;
};
type Ball = { x: number; y: number; vx: number; vy: number; state: "ready" | "rolling" | "sinking" | "gone"; sinkT: number; into?: Hole };

const sparkle = (x: number, y: number, n = 22) =>
  confetti({
    ...confettiStyle(),
    particleCount: n,
    spread: 360,
    startVelocity: 14,
    ticks: 55,
    origin: { x: x / window.innerWidth, y: y / window.innerHeight },
  });

// The shared machinery for the celebration and the game.
function createFlick(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  lane: Area,
  events: {
    onSink: (hole: Hole, x: number, y: number) => void;
    onMiss: () => void;
    canThrow: () => boolean;
  },
  opts: { speedUp: () => number },
) {
  let ballImg: HTMLImageElement | null = null;
  void loadImage(BALL_SRC).then((i) => (ballImg = i));
  const r = Math.max(12, lane.w * 0.045); // ball radius
  const launchY = lane.y + lane.h - r * 2.2;
  const holesTop = lane.y + r;
  const holesH = lane.h * 0.8;
  const holes: Hole[] = HOLES.map((h, i) => ({
    value: h.value,
    r: h.size * lane.w,
    y: holesTop + h.at * holesH,
    baseX: lane.x + lane.w / 2 + (h.x ?? 0) * lane.w,
    amp: h.slide * lane.w,
    phase: rand(0, Math.PI * 2),
    x: 0,
    catchSpeed: 0,
    catchDown: 0,
    ring: RING[i],
  }));
  const slope = TUNE.slope * H;
  // A ball that just reaches the top hole is going this fast at the launch.
  const topSpeed = Math.sqrt(2 * slope * (launchY - holes[0].y));
  HOLES.forEach((h, i) => {
    holes[i].catchSpeed = topSpeed * (TUNE.sink + TUNE.sinkPerSize * h.size);
    const sizes = HOLES.map((q) => q.size);
    const big = Math.max(...sizes);
    const small = Math.min(...sizes);
    const k = big === small ? 0 : (big - h.size) / (big - small); // 0 biggest … 1 smallest
    const overlap = TUNE.overlapBig + (TUNE.overlapSmall - TUNE.overlapBig) * k;
    holes[i].catchDown = holes[i].r + r - overlap * 2 * r;
  });
  const backWall = lane.y + r; // the ball bounces back off here
  const reach = launchY - backWall;
  let ball: Ball = newBall();
  let floater: { text: string; x: number; y: number; t: number } | null = null;

  function newBall(): Ball {
    return { x: lane.x + lane.w / 2, y: launchY, vx: 0, vy: 0, state: "ready", sinkT: 0 };
  }

  // Flicking: the ball follows your finger sideways while you hold it,
  // and the last moment of the drag sets its speed and direction.
  let trail: { x: number; y: number; t: number }[] = [];
  const clampX = (x: number) => Math.max(lane.x + r, Math.min(lane.x + lane.w - r, x));
  const input = gameInput({
    down: (x, y) => {
      if (ball.state !== "ready" || !events.canThrow()) return;
      trail = [{ x, y, t: performance.now() }];
      ball.x = clampX(x);
    },
    move: (x, y, pressed) => {
      if (!pressed || !trail.length || ball.state !== "ready") return;
      trail.push({ x, y, t: performance.now() });
      if (trail.length > 12) trail.shift();
      if (y > launchY - lane.h * 0.15) ball.x = clampX(x); // still holding it near the bottom
    },
    up: (x, y) => {
      if (!trail.length || ball.state !== "ready") return;
      const now = performance.now();
      trail.push({ x, y, t: now });
      const from = trail.find((p) => now - p.t < TUNE.flickWindow) ?? trail[0];
      const dt = Math.max(16, now - from.t) / 1000;
      trail = [];
      const vx = (x - from.x) / dt;
      const vy = (y - from.y) / dt;
      if (vy > -150) return; // not a flick up
      // How far it rolls grows in step with the flick's speed (so a
      // slightly harder flick goes slightly further, not much further).
      const f = (Math.hypot(vx, vy) - TUNE.flickSoft) / (TUNE.flickFirm - TUNE.flickSoft);
      const share = Math.max(TUNE.reachSoft, Math.min(TUNE.reachMax, TUNE.reachSoft + (1 - TUNE.reachSoft) * f));
      const speed = Math.sqrt(2 * slope * reach * share);
      const a = Math.max(-0.6, Math.min(0.6, Math.atan2(vx, -vy)));
      ball.vx = Math.sin(a) * speed;
      ball.vy = -Math.cos(a) * speed;
      ball.state = "rolling";
      void playSound("flap");
    },
    key: (dir) => {
      // Keyboard: up throws straight with a good roll.
      if (dir === "up" && ball.state === "ready" && events.canThrow()) {
        ball.vy = -topSpeed * rand(0.6, 1);
        ball.state = "rolling";
      }
      if (dir === "left" && ball.state === "ready") ball.x = clampX(ball.x - lane.w * 0.1);
      if (dir === "right" && ball.state === "ready") ball.x = clampX(ball.x + lane.w * 0.1);
    },
  });

  const step = (dt: number) => {
    const slide = Math.min(TUNE.holeSlideMax, TUNE.holeSlide + TUNE.holeSlideUp * opts.speedUp());
    for (const h of holes) {
      h.phase += (slide * lane.w * dt) / Math.max(1, h.amp);
      h.x = Math.max(lane.x + h.r, Math.min(lane.x + lane.w - h.r, h.baseX + Math.sin(h.phase) * h.amp));
    }
    if (floater && (floater.t += dt) > 1) floater = null;

    if (ball.state === "rolling") {
      const n = Math.ceil((Math.hypot(ball.vx, ball.vy) * dt) / (r * 0.5)) || 1;
      for (let i = 0; i < n && ball.state === "rolling"; i++) {
        const sdt = dt / n;
        ball.vy += slope * sdt;
        ball.x += ball.vx * sdt;
        ball.y += ball.vy * sdt;
        ball.vx *= 1 - 0.25 * sdt; // a little rolling friction sideways
        if (ball.x < lane.x + r) {
          ball.x = lane.x + r;
          ball.vx = Math.abs(ball.vx) * 0.7;
        } else if (ball.x > lane.x + lane.w - r) {
          ball.x = lane.x + lane.w - r;
          ball.vx = -Math.abs(ball.vx) * 0.7;
        }
        if (ball.y < backWall) {
          ball.y = backWall;
          ball.vy = Math.abs(ball.vy) * TUNE.backBounce; // off the back wall, back down the lane
          void playSound("thud");
        }
        // Going up: over a hole and slow enough for it. Rolling back down:
        // overlapping a hole by enough (any speed). In it goes.
        const speed = Math.hypot(ball.vx, ball.vy);
        const hole = holes.find((h) => {
          const d = Math.hypot(ball.x - h.x, ball.y - h.y);
          return ball.vy > 0 ? d < h.catchDown : speed < h.catchSpeed && d < h.r;
        });
        if (hole) {
          ball.state = "sinking";
          ball.into = hole;
          ball.sinkT = 0;
        }
        if (ball.y > launchY + r * 2) {
          ball.state = "gone"; // rolled all the way back: a miss
          void playSound("whoops");
          events.onMiss();
        }
      }
    } else if (ball.state === "sinking" && ball.into) {
      ball.sinkT += dt;
      ball.x += (ball.into.x - ball.x) * Math.min(1, dt * 14);
      ball.y += (ball.into.y - ball.y) * Math.min(1, dt * 14);
      if (ball.sinkT > 0.3) {
        const hole = ball.into;
        ball.state = "gone";
        void playSound(hole.value >= 100 ? "powerUp" : "pop");
        floater = { text: `+${hole.value}`, x: hole.x, y: hole.y, t: 0 };
        events.onSink(hole, hole.x, hole.y);
      }
    }
    if (ball.state === "gone" && events.canThrow()) ball = newBall(); // the next ball (none once they're used up)
  };

  const draw = (ballsLeft?: number) => {
    ctx.clearRect(0, 0, W, H);
    // The lane.
    ctx.fillStyle = color("primary", 0.07);
    ctx.beginPath();
    ctx.roundRect(lane.x - 6, lane.y - 6, lane.w + 12, lane.h + 12, 22);
    ctx.fill();
    ctx.strokeStyle = color("primary", 0.12);
    ctx.lineWidth = 2;
    for (let i = 1; i < 4; i++) {
      const x = lane.x + (lane.w * i) / 4;
      ctx.beginPath();
      ctx.moveTo(x, holesTop + holesH * 0.7);
      ctx.lineTo(x, lane.y + lane.h);
      ctx.stroke();
    }
    // The holes: a colored ring, dark inside, the value above.
    for (const h of holes) {
      ctx.fillStyle = color(h.ring);
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r + 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color("primary-strong", 0.85);
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
      ctx.fill();
      drawLabel(ctx, h.label ? `+${h.label}` : String(h.value), h.x, h.y, Math.round(Math.min(18, h.r * 0.7)));
    }
    // The ball (shrinking as it drops into a hole).
    if (ball.state !== "gone") {
      const s = ball.state === "sinking" ? Math.max(0.2, 1 - ball.sinkT / 0.3) : 1;
      const d = r * 2.2 * s;
      if (ballImg) ctx.drawImage(ballImg, ball.x - d / 2, ball.y - d / 2, d, d);
      else {
        ctx.fillStyle = color("party-red");
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, r * s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (floater) {
      ctx.globalAlpha = 1 - floater.t;
      drawLabel(ctx, floater.text, floater.x, floater.y - 20 - floater.t * 40, 22);
      ctx.globalAlpha = 1;
    }
    // Balls left (the game), as dots along the bottom.
    if (ballsLeft !== undefined) {
      const gap = r * 1.1;
      const x0 = lane.x + lane.w / 2 - ((TUNE.balls - 1) * gap) / 2;
      for (let i = 0; i < TUNE.balls; i++) {
        ctx.fillStyle = color(i < ballsLeft ? "party-red" : "primary", i < ballsLeft ? 1 : 0.15);
        ctx.beginPath();
        ctx.arc(x0 + i * gap, lane.y + lane.h - r * 0.55, r * 0.32, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  return { step, draw, holes, stop: input, ready: () => ball.state === "ready" };
}

// Celebration: some holes carry "+N" — sink a ball in one to collect it.
// As many balls as it takes, and the holes slide slowly.
export async function playFlick(opts: CelebrationOptions): Promise<void> {
  const { layer, ctx, W, H, area } = createCanvasGame("celebration");
  const chunks = [...pointChunks(opts.points ?? 0)];
  const total = chunks.length;
  let collected = 0;
  let revealed = false;
  let faded = false;
  const hint = hintBubble(layer, "Flick the ball up into a hole!", area.y + area.h * 0.62);
  const lane = { x: area.x + 14, y: area.y + 50, w: area.w - 28, h: area.h - 80 };
  const flick = createFlick(
    ctx,
    W,
    H,
    lane,
    {
      onSink: (hole, x, y) => {
        if (!hole.label) return;
        hole.label = undefined;
        collected++;
        sparkle(x, y);
        void playSound("powerUp");
        if (collected === total && !revealed) {
          revealed = true;
          opts.onReveal?.();
          setTimeout(() => void playSound("cheer"), 150);
          void fadeOutLayer(layer, 600).then(() => (faded = true));
        }
      },
      onMiss: () => {},
      canThrow: () => !revealed,
    },
    { speedUp: () => 0 },
  );
  // The chunks go on the lower (easier) holes first.
  const byEase = [...flick.holes].sort((a, b) => b.r - a.r);
  chunks.forEach((c, i) => (byEase[i % byEase.length].label = (byEase[i % byEase.length].label ?? 0) + c));
  const first = () => {
    hint.remove();
    window.removeEventListener("pointerdown", first);
  };
  window.addEventListener("pointerdown", first);

  await new Promise<void>((finish) => {
    runLoop(layer, (dt) => {
      flick.step(dt);
      flick.draw();
      if (faded) {
        finish();
        return false;
      }
    });
  });
  window.removeEventListener("pointerdown", first);
  flick.stop();
  layer.remove();
}

// "Keep playing": ten balls — score what you sink (10 to 100 a hole). The
// holes slide faster the more you've scored.
export function playFlickGame(opts: GameOptions): () => void {
  const { layer, ctx, W, H, safe } = createCanvasGame("game");
  let score = 0;
  let thrown = 0;
  let over = false;
  const hint = hintBubble(layer, "Flick the ball up into a hole!", safe.y + safe.h * 0.62);
  const lane = { x: safe.x + 10, y: safe.y + 10, w: safe.w - 20, h: safe.h - 20 };
  const resolved = () => {
    if (++thrown >= TUNE.balls && !over) {
      over = true;
      setTimeout(() => opts.onGameOver?.(), 500);
    }
  };
  const flick = createFlick(
    ctx,
    W,
    H,
    lane,
    {
      onSink: (hole, x, y) => {
        if (over) return;
        score += hole.value;
        opts.onScore(score);
        if (hole.value >= 50) sparkle(x, y, hole.value >= 100 ? 40 : 20);
        resolved();
      },
      onMiss: () => resolved(),
      canThrow: () => !over && thrown < TUNE.balls,
    },
    { speedUp: () => score / 10 },
  );
  const first = () => {
    hint.remove();
    window.removeEventListener("pointerdown", first);
  };
  window.addEventListener("pointerdown", first);
  const loop = runLoop(layer, (dt) => {
    flick.step(dt);
    flick.draw(TUNE.balls - thrown - (flick.ready() ? 0 : 1));
    return true;
  });

  const stop = () => {
    window.removeEventListener("pointerdown", first);
    loop();
    flick.stop();
    layer.remove();
  };
  onStop(stop);
  return stop;
}
