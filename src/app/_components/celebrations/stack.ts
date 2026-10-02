import confetti from "canvas-confetti";
import type MatterNS from "matter-js";
import { color, createCanvasGame, drawLabel, gameInput, loadImage, pointChunks, rand, runLoop, type Area } from "./canvasGame";
import { confettiStyle, fadeOutLayer, hintBubble, onStop, type CelebrationOptions, type GameOptions } from "./shared";
import { playSound } from "./sounds";

// Block stack: blocks fall from the sky and you slide the platform to catch
// them (drag anywhere — it follows your finger with a bit of lag). The
// tower rides on the platform with real (simple) physics via matter-js
// (loaded only when the game starts), so whipping the platform around can
// tip it over.
const BLOCK_SRC = "/anims/block.webp"; // a rounded square, stretched into shapes (corners kept)
const PLATFORM_SRC = "/anims/platform.webp";
const PLATFORM_ASPECT = 73 / 480;

// Block shapes in grid units (w × h) and their colors.
const SHAPES: [number, number][] = [[1, 1], [2, 1], [1, 2], [3, 1], [2, 2], [1, 1], [2, 1]];
const COLORS = ["party-pink", "party-yellow", "party-cyan", "party-red", "accent", "primary"];

let matter: typeof MatterNS | null = null;
const loadMatter = async () =>
  (matter ??= ((await import("matter-js")) as unknown as { default: typeof MatterNS }).default);

type Art = { platform: HTMLImageElement | null; blocks: HTMLCanvasElement[] }; // one block per color
type Block = {
  body: MatterNS.Body;
  w: number;
  h: number;
  look: number;
  label?: number;
  still: number; // seconds it's been at rest
  state: "falling" | "settled";
};

// The block art tinted each color (multiply, keeping its shading).
async function loadArt(): Promise<Art> {
  const [block, platform] = await Promise.all([loadImage(BLOCK_SRC), loadImage(PLATFORM_SRC)]);
  const blocks = block
    ? COLORS.map((token) => {
        const c = document.createElement("canvas");
        c.width = block.naturalWidth;
        c.height = block.naturalHeight;
        const g = c.getContext("2d")!;
        g.drawImage(block, 0, 0);
        g.globalCompositeOperation = "multiply";
        g.fillStyle = color(token);
        g.fillRect(0, 0, c.width, c.height);
        g.globalCompositeOperation = "destination-in";
        g.drawImage(block, 0, 0);
        return c;
      })
    : [];
  return { platform, blocks };
}

// Draws a block of any size from the square art without squashing its
// rounded corners (a 9-slice: corners as-is, edges and middle stretched).
function drawBlock(ctx: CanvasRenderingContext2D, art: Art, look: number, w: number, h: number, unit: number) {
  const src = art.blocks[look % Math.max(1, art.blocks.length)];
  if (!src) {
    ctx.fillStyle = color(COLORS[look % COLORS.length]);
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, unit * 0.22);
    ctx.fill();
    return;
  }
  const sw = src.width;
  const sh = src.height;
  const sc = sw * 0.3; // corner size in the art
  const dc = Math.min(unit * 0.3, w / 2, h / 2); // corner size on screen
  const xs = [0, sc, sw - sc, sw];
  const ys = [0, sc, sh - sc, sh];
  const xd = [-w / 2, -w / 2 + dc, w / 2 - dc, w / 2];
  const yd = [-h / 2, -h / 2 + dc, h / 2 - dc, h / 2];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      ctx.drawImage(
        src,
        xs[i],
        ys[j],
        xs[i + 1] - xs[i],
        ys[j + 1] - ys[j],
        xd[i],
        yd[j],
        xd[i + 1] - xd[i] + 0.5,
        yd[j + 1] - yd[j] + 0.5,
      );
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

// The shared machinery for the celebration and the game.
async function createStack(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  area: Area, // blocks that fall below it are gone
  safe: Area, // where blocks start and the platform slides
  events: { onSettle: (b: Block) => void; onLost: (b: Block) => void },
) {
  const M = await loadMatter();
  let art: Art = { platform: null, blocks: [] };
  void loadArt().then((a) => (art = a));
  const engine = M.Engine.create({ gravity: { x: 0, y: 1, scale: 0.0009 } });
  const unit = Math.round(Math.min(safe.w / 8, 44));
  const platW = Math.min(safe.w * 0.5, unit * 5);
  const platH = platW * PLATFORM_ASPECT;
  const platY = safe.y + safe.h - platH; // its center
  // Moved by hand each frame, with its velocity filled in so whatever is
  // stacked on it gets carried along (and thrown about by fast moves).
  const platform = M.Bodies.rectangle(W / 2, platY, platW, platH * 0.8, {
    isStatic: true,
    friction: 1,
    frictionStatic: 1,
    chamfer: { radius: platH * 0.3 },
  });
  M.Composite.add(engine.world, platform);
  // matter-js 0.20's setPosition takes `updateVelocity` (its types lag behind).
  const setPosition = M.Body.setPosition as (b: MatterNS.Body, p: MatterNS.Vector, updateVelocity?: boolean) => void;

  const blocks: Block[] = [];
  let target = W / 2;
  let platX = W / 2;
  let platVx = 0;
  let nextIn = 0.4;
  let looks = 0;

  // A new block falling from a random spot near the top.
  const spawn = (label?: number) => {
    const [sw, sh] = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    const w = sw * unit;
    const h = sh * unit;
    const x = rand(safe.x + w / 2 + 10, safe.x + safe.w - w / 2 - 10);
    const body = M.Bodies.rectangle(x, safe.y - h, w, h, {
      chamfer: { radius: unit * 0.18 },
      friction: 0.8,
      frictionStatic: 0.9,
      restitution: 0.02,
      density: 0.0015,
      angle: rand(-0.15, 0.15),
    });
    M.Composite.add(engine.world, body);
    blocks.push({ body, w, h, look: looks++ % COLORS.length, label, still: 0, state: "falling" });
  };

  // Moves the world one frame. `next` says what the next block carries:
  // a "+N", undefined for a plain block, or null for no more blocks.
  const step = (dt: number, next: () => number | undefined | null) => {
    if (dt > 0 && !blocks.some((b) => b.state === "falling") && (nextIn -= dt) <= 0) {
      const label = next();
      if (label !== null) spawn(label);
      nextIn = 0.5;
    }
    // The platform chases the finger with a little lag.
    platVx += (target - platX) * 60 * dt;
    platVx *= Math.exp(-9 * dt);
    const half = platW / 2;
    const ms = Math.min(dt, 1 / 20) * 1000;
    for (let i = 0; i < 2; i++) {
      const nx = Math.max(safe.x + half, Math.min(safe.x + safe.w - half, platX + (platVx * ms) / 2000));
      setPosition(platform, { x: nx, y: platY }, true);
      platX = nx;
      if (ms > 0) M.Engine.update(engine, ms / 2);
    }

    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i];
      if (b.body.position.y > area.y + area.h + 80) {
        // Fell past the platform.
        M.Composite.remove(engine.world, b.body);
        blocks.splice(i, 1);
        events.onLost(b);
        continue;
      }
      if (b.state === "falling") {
        // At rest on the tower (riding along with the platform counts).
        const v = b.body.velocity;
        const resting =
          Math.abs(v.y) < 0.3 && Math.abs(v.x - platform.velocity.x) < 0.6 && Math.abs(b.body.angularVelocity) < 0.03;
        b.still = resting ? b.still + dt : 0;
        if (b.still > 0.3 && b.body.position.y < platY) {
          b.state = "settled";
          void playSound("thud");
          events.onSettle(b);
        }
      }
    }
  };

  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    for (const b of blocks) {
      ctx.save();
      ctx.translate(b.body.position.x, b.body.position.y);
      ctx.rotate(b.body.angle);
      drawBlock(ctx, art, b.look, b.w, b.h, unit);
      ctx.restore();
      if (b.label && b.state === "falling") drawLabel(ctx, `+${b.label}`, b.body.position.x, b.body.position.y, 20);
    }
    if (art.platform) ctx.drawImage(art.platform, platX - platW / 2, platY - platH / 2, platW, platH);
    else {
      ctx.fillStyle = color("accent");
      ctx.beginPath();
      ctx.roundRect(platX - platW / 2, platY - platH / 2, platW, platH, platH / 2);
      ctx.fill();
    }
  };

  return {
    step,
    draw,
    aim: (x: number) => (target = x),
    stop: () => M.Engine.clear(engine),
  };
}

// Celebration: blocks carrying "+N" fall one at a time — slide the platform
// under them to catch them. Each counts once it settles on the tower; one
// that falls off comes back for another go. Nothing falls until the kid
// touches the screen.
export async function playStack(opts: CelebrationOptions): Promise<void> {
  const { layer, ctx, W, H, area } = createCanvasGame("celebration");
  const waiting = [...pointChunks(opts.points ?? 0)];
  const total = waiting.length;
  let collected = 0;
  let revealed = false;
  let faded = false;
  const hint = hintBubble(layer, "Slide to catch the blocks!", area.y + 16);
  const stack = await createStack(ctx, W, H, area, { ...area, y: area.y + 70, h: area.h - 100 }, {
    onSettle: (b) => {
      if (!b.label) return;
      collected++;
      sparkle(b.body.position.x, b.body.position.y);
      void playSound("powerUp");
      if (collected === total && !revealed) {
        revealed = true;
        opts.onReveal?.();
        setTimeout(() => void playSound("cheer"), 150);
        void fadeOutLayer(layer, 500).then(() => (faded = true));
      }
    },
    onLost: (b) => {
      if (b.label) waiting.push(b.label); // try that one again
      void playSound("pop");
    },
  });

  let touched = false;
  gameInput({
    down: (x) => {
      touched = true;
      hint.remove();
      stack.aim(x);
    },
    move: (x, _y, pressed) => pressed && stack.aim(x),
  });

  await new Promise<void>((finish) => {
    runLoop(layer, (dt) => {
      stack.step(touched ? dt : 0, () => (waiting.length && !revealed ? waiting.shift() : null));
      stack.draw();
      if (faded) {
        finish();
        return false;
      }
    });
  });
  stack.stop();
  layer.remove();
}

// "Keep playing": catch and stack as many as you can, +1 for every block
// that settles. Every block that falls — missed, or knocked off the tower —
// costs one of three lives.
export function playStackGame(opts: GameOptions): () => void {
  const { layer, ctx, W, H, area, safe } = createCanvasGame("game");
  let score = 0;
  let lives = 3;
  opts.onLives?.(lives);
  let over = false;
  let touched = false;
  const hint = hintBubble(layer, "Slide to catch the blocks!", safe.y + 16);
  let stop = () => layer.remove();

  void createStack(ctx, W, H, area, { ...safe, y: safe.y + 60, h: safe.h - 60 }, {
    onSettle: () => opts.onScore(++score),
    onLost: () => {
      if (over) return;
      lives -= 1;
      opts.onLives?.(lives);
      void playSound("boom");
      if (lives <= 0) {
        over = true;
        opts.onGameOver?.();
      }
    },
  }).then((stack) => {
    gameInput({
      down: (x) => {
        touched = true;
        hint.remove();
        stack.aim(x);
      },
      move: (x, _y, pressed) => pressed && stack.aim(x),
    });
    runLoop(layer, (dt) => {
      stack.step(touched && !over ? dt : 0, () => (over ? null : undefined));
      stack.draw();
      return !over;
    });
    const prev = stop;
    stop = () => {
      stack.stop();
      prev();
    };
  });

  onStop(() => stop());
  return () => stop();
}
