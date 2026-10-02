import confetti from "canvas-confetti";
import { color, createCanvasGame, drawLabel, gameInput, loadImage, pointChunks, rand, runLoop, type Area } from "./canvasGame";
import { confettiStyle, fadeOutLayer, hintBubble, onStop, type CelebrationOptions, type GameOptions } from "./shared";
import { playSound } from "./sounds";

// Artwork: the bird (facing left, flipped to fly right) and its wing, which
// is drawn separately so it can flap; the pipe (cap on top, body fading
// out below — flipped for the top pipes); background clouds.
const BIRD_SRC = "/anims/bird.webp";
const WING_SRC = "/anims/bird-wing.webp";
const PIPE_SRC = "/anims/pipe.webp";
const CLOUD_SRCS = ["/anims/cloud-1.webp", "/anims/cloud-2.webp"];
const COIN_SRC = "/anims/coin.webp";
const COIN_ASPECT = 125 / 120;
const BIRD_ASPECT = 217 / 240; // height / width
const WING_ASPECT = 162 / 140;
// The wing, as in the reference art: 54% of the bird's width, its base (the
// shoulder, in the wing art) just behind the head (in the bird art) — as
// fractions of each image's size. It flaps around that point.
const WING_WIDTH = 335 / 616; // the two artworks are drawn at the same scale
const WING_BASE = { x: 0.11, y: 0.87 };
const WING_ON_BACK = { x: 0.39, y: 0.52 };
// The pipe art: the cap is the top 19%; the body is 75% of the cap's width.
const PIPE_ASPECT = 429 / 240;
const PIPE_CAP = 0.19;
const PIPE_BODY_WIDTH = 0.75;

const PIPE_W = 72;
const PIPE_SPACING = 320; // between pipes in the "Keep playing" game
const GRAVITY = 1500; // px/s²
const FLAP = -440; // px/s
const MAX_FALL = 620;

type Art = {
  bird: HTMLImageElement | null;
  wing: HTMLImageElement | null;
  pipe: HTMLImageElement | null;
  coin: HTMLImageElement | null;
  clouds: HTMLImageElement[];
};
type Coin = { x: number; y: number };
type Cloud = { x: number; y: number; w: number; speed: number; img: number };
type Bird = { x: number; y: number; vy: number; flapAt: number; hurt: number };
type Pipe = { x: number; gapY: number; gap: number; passed: boolean; label?: number };

const loadArt = async (): Promise<Art> => {
  const [bird, wing, pipe, coin, ...clouds] = await Promise.all(
    [BIRD_SRC, WING_SRC, PIPE_SRC, COIN_SRC, ...CLOUD_SRCS].map((s) => loadImage(s)),
  );
  return { bird, wing, pipe, coin, clouds: clouds.filter(Boolean) as HTMLImageElement[] };
};
const noArt: Art = { bird: null, wing: null, pipe: null, coin: null, clouds: [] };

// A spinning coin (it flips side to side).
function drawCoin(ctx: CanvasRenderingContext2D, art: Art, c: Coin, size: number, time: number) {
  const flip = Math.max(0.15, Math.abs(Math.cos(time * 3 + c.x * 0.01)));
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.scale(flip, 1);
  if (art.coin) ctx.drawImage(art.coin, -size / 2, (-size * COIN_ASPECT) / 2, size, size * COIN_ASPECT);
  else {
    ctx.fillStyle = color("party-yellow");
    ctx.beginPath();
    ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// A few clouds drifting slowly behind everything (a little parallax).
function makeClouds(area: Area): Cloud[] {
  return Array.from({ length: 4 }, (_, i) => ({
    x: rand(area.x, area.x + area.w),
    y: rand(area.y, area.y + area.h * 0.75),
    w: rand(90, 170),
    speed: rand(14, 32),
    img: i,
  }));
}
function driftClouds(ctx: CanvasRenderingContext2D, art: Art, clouds: Cloud[], area: Area, dt: number) {
  if (!art.clouds.length) return;
  for (const c of clouds) {
    c.x -= c.speed * dt;
    if (c.x < area.x - c.w) {
      c.x = area.x + area.w + rand(0, 120);
      c.y = rand(area.y, area.y + area.h * 0.75);
    }
    const img = art.clouds[c.img % art.clouds.length];
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.drawImage(img, c.x, c.y, c.w, (c.w * img.naturalHeight) / img.naturalWidth);
    ctx.restore();
  }
}

function drawBird(ctx: CanvasRenderingContext2D, art: Art, b: Bird, size: number, time: number) {
  const w = size;
  const h = size * BIRD_ASPECT;
  ctx.save();
  ctx.translate(b.x, b.y);
  if (b.hurt > 0 && Math.floor(b.hurt * 12) % 2 === 0) ctx.globalAlpha = 0.4; // flicker while safe
  ctx.rotate(Math.max(-0.45, Math.min(0.9, b.vy / 700))); // nose up when rising, down when falling
  ctx.scale(-1, 1); // the artwork faces left
  if (art.bird) ctx.drawImage(art.bird, -w / 2, -h / 2, w, h);
  else {
    ctx.fillStyle = color("party-cyan");
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (art.wing) {
    // A big down-stroke right after each flap, a gentle flutter otherwise.
    const since = time - b.flapAt;
    const angle = since < 0.28 ? Math.sin((since / 0.28) * Math.PI) * 1.1 : Math.sin(time * 7) * 0.15;
    const ww = w * WING_WIDTH;
    const wh = ww * WING_ASPECT;
    ctx.translate(-w / 2 + w * WING_ON_BACK.x, -h / 2 + h * WING_ON_BACK.y);
    ctx.rotate(angle);
    ctx.drawImage(art.wing, -ww * WING_BASE.x, -wh * WING_BASE.y, ww, wh);
  }
  ctx.restore();
}

// The pipes above and below the gap: the cap at the gap, the body stretched
// away from it to the edge of the screen, fading out as it goes.
function drawPipe(ctx: CanvasRenderingContext2D, art: Art, p: Pipe, top: number, bottom: number) {
  const gapTop = p.gapY - p.gap / 2;
  const gapBottom = p.gapY + p.gap / 2;
  const img = art.pipe;
  if (img) {
    const capW = PIPE_W / PIPE_BODY_WIDTH;
    const capH = capW * PIPE_ASPECT * PIPE_CAP;
    const sw = img.naturalWidth;
    const sh = img.naturalHeight;
    const capSrc = sh * PIPE_CAP;
    // One pipe drawn from the gap edge outward (`dir` 1 = down, -1 = up).
    const one = (edge: number, length: number, dir: 1 | -1) => {
      const body = Math.max(capW * PIPE_ASPECT * (1 - PIPE_CAP), (length - capH) / 0.85);
      ctx.save();
      ctx.translate(p.x + PIPE_W / 2, edge);
      ctx.scale(1, dir);
      ctx.drawImage(img, 0, 0, sw, capSrc, -capW / 2, 0, capW, capH);
      ctx.drawImage(img, 0, capSrc, sw, sh - capSrc, -capW / 2, capH - 1, capW, body);
      ctx.restore();
    };
    one(gapBottom, bottom - gapBottom, 1);
    one(gapTop, gapTop - top, -1);
    if (p.label && !p.passed) drawLabel(ctx, `+${p.label}`, p.x + PIPE_W / 2, p.gapY, 24);
    return;
  }
  const cap = 18;
  ctx.fillStyle = color("primary", 0.22);
  ctx.beginPath();
  ctx.roundRect(p.x, top - 40, PIPE_W, gapTop - top + 40, 14);
  ctx.roundRect(p.x, gapBottom, PIPE_W, bottom - gapBottom + 40, 14);
  ctx.fill();
  ctx.fillStyle = color("primary", 0.38);
  ctx.beginPath();
  ctx.roundRect(p.x - 6, gapTop - cap, PIPE_W + 12, cap, 8);
  ctx.roundRect(p.x - 6, gapBottom, PIPE_W + 12, cap, 8);
  ctx.fill();
  if (p.label && !p.passed) drawLabel(ctx, `+${p.label}`, p.x + PIPE_W / 2, p.gapY, 24);
}

// Does the bird (a circle) touch the pipe?
function hits(b: Bird, r: number, p: Pipe) {
  if (b.x + r < p.x || b.x - r > p.x + PIPE_W) return false;
  const nx = Math.max(p.x, Math.min(b.x, p.x + PIPE_W));
  const clear = (edgeY: number, above: boolean) => {
    const ny = above ? Math.min(b.y, edgeY) : Math.max(b.y, edgeY);
    return Math.hypot(b.x - nx, b.y - ny) >= r;
  };
  return !(clear(p.gapY - p.gap / 2, true) && clear(p.gapY + p.gap / 2, false));
}

const sparkle = (x: number, y: number) =>
  confetti({
    ...confettiStyle(),
    particleCount: 18,
    spread: 360,
    startVelocity: 12,
    ticks: 50,
    origin: { x: x / window.innerWidth, y: y / window.innerHeight },
  });

// Steps the bird: gravity, a floor bounce and a ceiling. Returns true when
// it hit the floor.
function fall(b: Bird, dt: number, top: number, floor: number, r: number) {
  b.vy = Math.min(MAX_FALL, b.vy + GRAVITY * dt);
  b.y += b.vy * dt;
  b.hurt = Math.max(0, b.hurt - dt);
  if (b.y - r < top) {
    b.y = top + r;
    b.vy = Math.max(0, b.vy);
  }
  if (b.y + r > floor) {
    b.y = floor - r;
    return true;
  }
  return false;
}

const randomGap = (area: Area, gap: number) => rand(area.y + gap / 2 + 30, area.y + area.h - gap / 2 - 30);

// Celebration: tap to flap through the gaps holding "+N". Nothing moves
// until the first tap. Bumping a pipe (or the ground) just bounces the
// bird — that "+N" comes round again on a later pipe. Collect them all to
// reveal the points.
export async function playFlappy(opts: CelebrationOptions): Promise<void> {
  const { layer, ctx, W, H, area } = createCanvasGame("celebration");
  const art = await loadArt();
  const size = Math.min(W * 0.18, 76);
  const r = size * 0.36;
  const bird: Bird = { x: W * 0.28, y: area.y + area.h * 0.45, vy: 0, flapAt: -1, hurt: 0 };
  const waiting = [...pointChunks(opts.points ?? 0)]; // "+N"s not yet on a pipe
  let collected = 0;
  const total = waiting.length;
  const pipes: Pipe[] = [];
  const clouds = makeClouds(area);
  const gap = Math.min(240, area.h * 0.34);
  const hint = hintBubble(layer, "Tap to flap!", area.y + 16);
  let started = false;
  let revealed = false;
  let faded = false;

  gameInput({
    down: () => {
      hint.remove();
      started = true;
      bird.vy = FLAP;
      bird.flapAt = performance.now() / 1000;
      void playSound("flap");
    },
  });

  await new Promise<void>((finish) => {
    runLoop(layer, (dt) => {
      const time = performance.now() / 1000;
      if (!started) {
        bird.y = area.y + area.h * 0.45 + Math.sin(time * 3) * 8; // hover until the first tap
      } else if (!revealed) {
        if (fall(bird, dt, area.y, area.y + area.h, r)) {
          bird.vy = FLAP * 0.8; // bounce off the ground
          bird.hurt = 0.8;
          void playSound("thud");
        }
        // Keep pipes coming while any "+N" is still out there.
        const last = pipes[pipes.length - 1];
        if (waiting.length && (!last || last.x < W - 230)) {
          pipes.push({ x: W + 20, gapY: randomGap(area, gap), gap, passed: false, label: waiting.shift() });
        }
        for (const p of pipes) {
          p.x -= 150 * dt;
          if (!p.passed && bird.hurt === 0 && hits(bird, r, p)) {
            p.passed = true; // missed this one
            if (p.label) waiting.push(p.label);
            bird.vy = FLAP * 0.6;
            bird.hurt = 0.8;
            void playSound("thud");
          }
          if (!p.passed && p.x + PIPE_W < bird.x - r) {
            p.passed = true;
            if (p.label) {
              collected++;
              sparkle(bird.x, bird.y);
              void playSound("powerUp");
            }
          }
        }
        while (pipes.length && pipes[0].x < -PIPE_W - 20) pipes.shift();
        if (collected === total) {
          revealed = true;
          opts.onReveal?.();
          setTimeout(() => void playSound("cheer"), 150);
          void fadeOutLayer(layer, 300).then(() => (faded = true));
        }
      }
      if (faded) {
        finish();
        return false;
      }
      ctx.clearRect(0, 0, W, H);
      driftClouds(ctx, art, clouds, area, dt);
      pipes.forEach((p) => drawPipe(ctx, art, p, area.y, area.y + area.h));
      drawBird(ctx, art, bird, size, time);
    });
  });
  layer.remove();
}

// "Keep playing": classic flappy — tap to flap through the gaps, +1 per
// pipe and +1 per coin (one floats between each pair of pipes, up or down
// from the way through). Gaps narrow and pipes speed up as it goes. Three lives: hitting a
// pipe or the ground costs one (then a moment to recover).
export function playFlappyGame(opts: GameOptions): () => void {
  const { layer, ctx, W, H, area, safe } = createCanvasGame("game");
  let art: Art = noArt;
  void loadArt().then((a) => (art = a));
  const size = Math.min(W * 0.16, 70);
  const r = size * 0.36;
  const bird: Bird = { x: W * 0.28, y: safe.y + safe.h * 0.45, vy: 0, flapAt: -1, hurt: 0 };
  const pipes: Pipe[] = [];
  const coins: Coin[] = [];
  const coinSize = 34;
  const clouds = makeClouds(area);
  const hint = hintBubble(layer, "Tap to flap!", safe.y + 16);
  let started = false;
  let elapsed = 0;
  let score = 0;
  let lives = 3;
  opts.onLives?.(lives);

  const flap = () => {
    hint.remove();
    started = true;
    bird.vy = FLAP;
    bird.flapAt = performance.now() / 1000;
    void playSound("flap");
  };
  gameInput({ down: flap, key: (dir) => dir === "up" && flap() });

  const hurt = () => {
    lives -= 1;
    opts.onLives?.(lives);
    void playSound("boom");
    bird.hurt = 1.5;
    bird.vy = FLAP * 0.7;
    if (lives <= 0) {
      opts.onGameOver?.();
      return true;
    }
    return false;
  };

  runLoop(layer, (dt) => {
    const time = performance.now() / 1000;
    if (!started) {
      bird.y = safe.y + safe.h * 0.45 + Math.sin(time * 3) * 8;
    } else {
      elapsed += dt;
      const speed = Math.min(260, 150 + elapsed * 3);
      const gap = Math.max(160, 230 - elapsed * 2);
      if (fall(bird, dt, area.y, area.y + area.h, r) && bird.hurt === 0 && hurt()) return false;
      const last = pipes[pipes.length - 1];
      if (!last || last.x < W - PIPE_SPACING) {
        const next: Pipe = { x: W + 20, gapY: randomGap(safe, gap), gap, passed: false };
        // A coin in the open space between this pipe and the last one — up
        // or down from the line between the gaps, so some take a swoop.
        if (last) {
          const y = (last.gapY + next.gapY) / 2 + rand(-1, 1) * gap * 0.7;
          coins.push({
            x: (last.x + PIPE_W + next.x) / 2,
            y: Math.max(safe.y + coinSize, Math.min(safe.y + safe.h - coinSize, y)),
          });
        }
        pipes.push(next);
      }
      for (let i = coins.length - 1; i >= 0; i--) {
        const c = coins[i];
        c.x -= speed * dt;
        if (Math.hypot(c.x - bird.x, c.y - bird.y) < r + coinSize / 2) {
          coins.splice(i, 1);
          opts.onScore(++score);
          void playSound("waka", 0);
          sparkle(c.x, c.y);
        } else if (c.x < -coinSize) coins.splice(i, 1);
      }
      for (const p of pipes) {
        p.x -= speed * dt;
        if (bird.hurt === 0 && hits(bird, r, p) && hurt()) return false;
        if (!p.passed && p.x + PIPE_W < bird.x - r) {
          p.passed = true;
          opts.onScore(++score);
          void playSound("waka", 1);
        }
      }
      while (pipes.length && pipes[0].x < -PIPE_W - 20) pipes.shift();
    }
    ctx.clearRect(0, 0, W, H);
    driftClouds(ctx, art, clouds, area, dt);
    pipes.forEach((p) => drawPipe(ctx, art, p, area.y, area.y + area.h));
    coins.forEach((c) => drawCoin(ctx, art, c, coinSize, time));
    drawBird(ctx, art, bird, size, time);
  });

  const stop = () => layer.remove();
  onStop(stop);
  return stop;
}
