import confetti from "canvas-confetti";
import type MatterNS from "matter-js";
import { color, createCanvasGame, drawLabel, gameInput, loadImage, pointChunks, runLoop, type Area } from "./canvasGame";
import { confettiStyle, fadeOutLayer, hintBubble, onStop, type CelebrationOptions, type GameOptions } from "./shared";
import { playSound } from "./sounds";

// Block stack: a block hangs at the top and follows your finger (with a
// little momentum — move fast and it keeps sliding when you let go); let go
// to drop it onto the platform. Real (simple) physics via matter-js, loaded
// only when the game starts.
const BLOCK_SRC = "/anims/block.webp"; // a rounded square, stretched into shapes (corners kept)
const PLATFORM_SRC = "/anims/platform.webp";
const PLATFORM_ASPECT = 73 / 480;

// Block shapes in grid units (w × h) and their colors.
const SHAPES: [number, number][] = [[1, 1], [2, 1], [1, 2], [3, 1], [2, 2], [1, 1], [2, 1]];
const COLORS = ["party-pink", "party-yellow", "party-cyan", "party-red", "accent", "primary"];

let matter: typeof MatterNS | null = null;
const loadMatter = async () => (matter ??= ((await import("matter-js")) as unknown as { default: typeof MatterNS }).default);

type Art = { platform: HTMLImageElement | null; blocks: CanvasImageSource[] }; // one block per color
type Block = {
  body: MatterNS.Body;
  w: number;
  h: number;
  look: number;
  label?: number;
  still: number; // seconds it's been at rest
  state: "falling" | "settled";
};
type Pending = { w: number; h: number; look: number; label?: number; x: number; vx: number };

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
  const sw = (src as HTMLCanvasElement).width;
  const sh = (src as HTMLCanvasElement).height;
  const sc = sw * 0.3; // corner size in the art
  const dc = Math.min(unit * 0.3, w / 2, h / 2); // corner size on screen
  const xs = [0, sc, sw - sc, sw];
  const ys = [0, sc, sh - sc, sh];
  const xd = [-w / 2, -w / 2 + dc, w / 2 - dc, w / 2];
  const yd = [-h / 2, -h / 2 + dc, h / 2 - dc, h / 2];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      ctx.drawImage(src, xs[i], ys[j], xs[i + 1] - xs[i], ys[j + 1] - ys[j], xd[i], yd[j], xd[i + 1] - xd[i] + 0.5, yd[j + 1] - yd[j] + 0.5);
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

// The shared stacking machinery for the celebration and the game.
async function createStack(
  layer: HTMLElement,
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  area: Area, // where things can be (blocks fall off below it)
  safe: Area, // where the hanging block and the platform sit
  events: { onSettle: (b: Block) => void; onLost: (b: Block) => void },
) {
  const M = await loadMatter();
  let art: Art = { platform: null, blocks: [] };
  void loadArt().then((a) => (art = a));
  const engine = M.Engine.create({ gravity: { x: 0, y: 1, scale: 0.0012 } });
  const unit = Math.round(Math.min(safe.w / 8, 46));
  const platW = Math.min(safe.w * 0.62, unit * 6);
  const platH = platW * PLATFORM_ASPECT;
  const platY = safe.y + safe.h - platH; // its center
  const platform = M.Bodies.rectangle(W / 2, platY, platW, platH * 0.8, { isStatic: true, friction: 1, chamfer: { radius: platH * 0.3 } });
  M.Composite.add(engine.world, platform);

  const blocks: Block[] = [];
  let pending: Pending | null = null;
  let target = W / 2;
  let nextIn = 0;
  let camY = 0; // world y at the top of the screen
  let looks = 0;

  const newPending = (label?: number): Pending => {
    const [sw, sh] = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    return { w: sw * unit, h: sh * unit, look: looks++ % COLORS.length, label, x: target, vx: 0 };
  };

  const drop = () => {
    if (!pending) return;
    const p = pending;
    pending = null;
    const y = camY + safe.y + 60 + p.h / 2;
    const body = M.Bodies.rectangle(p.x, y, p.w, p.h, {
      chamfer: { radius: unit * 0.18 },
      friction: 0.9,
      frictionStatic: 1,
      restitution: 0.02,
      density: 0.0015,
    });
    // Keep the sideways speed it had while hanging (momentum!).
    M.Body.setVelocity(body, { x: p.vx / 60, y: 1 });
    M.Composite.add(engine.world, body);
    blocks.push({ body, w: p.w, h: p.h, look: p.look, label: p.label, still: 0, state: "falling" });
    void playSound("flap");
    nextIn = 0.7;
  };

  // Moves the world one frame. `next` supplies the next hanging block
  // (or null for none).
  const step = (dt: number, next: () => Pending | null) => {
    if (!pending && (nextIn -= dt) <= 0) pending = next();
    if (pending) {
      // The hanging block chases the finger with a bit of swing.
      pending.vx += (target - pending.x) * 40 * dt;
      pending.vx *= Math.exp(-7 * dt);
      pending.x = Math.max(area.x + pending.w / 2, Math.min(area.x + area.w - pending.w / 2, pending.x + pending.vx * dt));
    }
    const ms = Math.min(dt, 1 / 20) * 1000;
    M.Engine.update(engine, ms / 2);
    M.Engine.update(engine, ms / 2);

    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i];
      if (b.body.position.y > platY + H) {
        // Fell off the platform.
        M.Composite.remove(engine.world, b.body);
        blocks.splice(i, 1);
        events.onLost(b);
        continue;
      }
      if (b.state === "falling") {
        const resting = b.body.speed < 0.25 && Math.abs(b.body.angularVelocity) < 0.02;
        b.still = resting ? b.still + dt : 0;
        if (b.still > 0.35 && b.body.position.y < platY) {
          b.state = "settled";
          void playSound("thud");
          events.onSettle(b);
        }
      }
    }

    // Scroll up as the tower grows: keep its top in the lower part of the screen.
    const top = Math.min(platY, ...blocks.filter((b) => b.state === "settled").map((b) => b.body.bounds.min.y));
    const want = Math.min(0, top - (safe.y + safe.h * 0.5));
    camY += (want - camY) * Math.min(1, dt * 3);
  };

  const draw = (time: number) => {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(0, -camY);
    // Platform.
    if (art.platform) ctx.drawImage(art.platform, W / 2 - platW / 2, platY - platH / 2, platW, platH);
    else {
      ctx.fillStyle = color("accent");
      ctx.beginPath();
      ctx.roundRect(W / 2 - platW / 2, platY - platH / 2, platW, platH, platH / 2);
      ctx.fill();
    }
    for (const b of blocks) {
      ctx.save();
      ctx.translate(b.body.position.x, b.body.position.y);
      ctx.rotate(b.body.angle);
      drawBlock(ctx, art, b.look, b.w, b.h, unit);
      ctx.restore();
      if (b.label && b.state === "falling") drawLabel(ctx, `+${b.label}`, b.body.position.x, b.body.position.y, 20);
    }
    ctx.restore();

    // The hanging block, with a guide line down to where it'll land.
    if (pending) {
      const y = safe.y + 60 + pending.h / 2;
      ctx.save();
      ctx.strokeStyle = color("primary", 0.25);
      ctx.setLineDash([6, 8]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pending.x, y + pending.h / 2);
      ctx.lineTo(pending.x, H);
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.translate(pending.x, y + Math.sin(time * 3) * 3);
      ctx.rotate(Math.max(-0.2, Math.min(0.2, -pending.vx / 1500))); // tilts as it swings
      drawBlock(ctx, art, pending.look, pending.w, pending.h, unit);
      ctx.restore();
      if (pending.label) drawLabel(ctx, `+${pending.label}`, pending.x, y, 20);
    }
  };

  return {
    newPending,
    drop,
    step,
    draw,
    aim: (x: number) => (target = x),
    screenY: (worldY: number) => worldY - camY,
    hasPending: () => pending !== null,
    stop: () => M.Engine.clear(engine),
  };
}

// Celebration: each hanging block carries a "+N". Drag it over the tower,
// let go to drop; it counts once it settles. One that falls off comes back
// for another go. Stack them all to reveal the points.
export async function playStack(opts: CelebrationOptions): Promise<void> {
  const { layer, ctx, W, H, area } = createCanvasGame("celebration");
  const waiting = [...pointChunks(opts.points ?? 0)];
  const total = waiting.length;
  let collected = 0;
  let revealed = false;
  let faded = false;
  const hint = hintBubble(layer, "Drag, then let go to drop!", area.y + 16);
  const stack = await createStack(layer, ctx, W, H, area, { ...area, h: area.h - 30 }, {
    onSettle: (b) => {
      if (!b.label) return;
      collected++;
      sparkle(b.body.position.x, stack.screenY(b.body.position.y));
      void playSound("powerUp");
      if (collected === total && !revealed) {
        revealed = true;
        hint.remove();
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
    up: () => stack.drop(),
  });

  await new Promise<void>((finish) => {
    runLoop(layer, (dt, time) => {
      // Time stands still until the kid plays (the first block just hangs there).
      stack.step(touched ? dt : 0, () => (waiting.length && !revealed ? stack.newPending(waiting.shift()) : null));
      stack.draw(time);
      if (faded) {
        finish();
        return false;
      }
    });
  });
  stack.stop();
  layer.remove();
}

// "Keep playing": stack as high as you can, +1 for every block that
// settles. Every block that falls off — dropped or knocked off the tower —
// costs one of three lives.
export function playStackGame(opts: GameOptions): () => void {
  const { layer, ctx, W, H, area, safe } = createCanvasGame("game");
  let score = 0;
  let lives = 3;
  opts.onLives?.(lives);
  let over = false;
  const hint = hintBubble(layer, "Drag, then let go to drop!", safe.y + 16);
  let stop = () => layer.remove();

  void createStack(layer, ctx, W, H, area, safe, {
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
        hint.remove();
        stack.aim(x);
      },
      move: (x, _y, pressed) => pressed && stack.aim(x),
      up: () => !over && stack.drop(),
    });
    runLoop(layer, (dt, time) => {
      stack.step(over ? 0 : dt, () => (over ? null : stack.newPending()));
      stack.draw(time);
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
