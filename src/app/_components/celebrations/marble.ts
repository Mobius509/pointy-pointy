import confetti from "canvas-confetti";
import type MatterNS from "matter-js";
import { color, createCanvasGame, drawLabel, gameInput, loadImage, pointChunks, runLoop, type Area } from "./canvasGame";
import { confettiStyle, fadeOutLayer, hintBubble, onStop, type CelebrationOptions, type GameOptions } from "./shared";
import { playSound } from "./sounds";
import { drawNineSlice, loadBlockArt, loadMatter, tintBlock } from "./stack";

// Marble tilt: tilt the phone to roll a marble around a little maze and
// collect the coins. No tilt sensor (or it's not allowed)? Hold a finger
// where the marble should roll. Physics via matter-js.
const MARBLE_SRC = "/anims/orb-pearl.webp";
const COIN_SRC = "/anims/coin.webp";
const COIN_ASPECT = 125 / 120;

// Mazes are made fresh each time, as rows of characters:
// # wall · . open · c coin spot · o hole · s start.
//
// 1. Carve a random maze (every spot connected), then knock out about a
//    third of the inner walls so there are loops and little rooms — never
//    just one path, and room to get around holes.
// 2. Start somewhere random; coins go in dead ends and far corners.
// 3. Holes: never right next to a coin or the start, and each one is only
//    kept if every coin can still be reached from the start without
//    rolling over a hole.
export function generateMaze(cols = 9, rows = 13, coinCount = 6, holeCount = 4): string[] {
  const g = Array.from({ length: rows }, () => Array.from({ length: cols }, () => "#"));
  const cw = (cols - 1) / 2; // rooms across (on odd squares)
  const ch = (rows - 1) / 2;
  const at = (cx: number, cy: number) => [cx * 2 + 1, cy * 2 + 1];
  const shuffle = <T,>(a: T[]) => a.sort(() => Math.random() - 0.5);

  // 1. Depth-first carve.
  const seen = new Set<string>();
  const carve = (cx: number, cy: number) => {
    seen.add(`${cx},${cy}`);
    const [x, y] = at(cx, cy);
    g[y][x] = ".";
    for (const [dx, dy] of shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]])) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= cw || ny >= ch || seen.has(`${nx},${ny}`)) continue;
      g[y + dy][x + dx] = ".";
      carve(nx, ny);
    }
  };
  carve(Math.floor(Math.random() * cw), Math.floor(Math.random() * ch));
  // …then open some extra gaps between rooms (loops).
  for (let y = 1; y < rows - 1; y++)
    for (let x = 1; x < cols - 1; x++) {
      if (g[y][x] !== "#") continue;
      const across = x % 2 === 0 && y % 2 === 1 && g[y][x - 1] === "." && g[y][x + 1] === ".";
      const down = x % 2 === 1 && y % 2 === 0 && g[y - 1][x] === "." && g[y + 1][x] === ".";
      if ((across || down) && Math.random() < 0.33) g[y][x] = ".";
    }

  // 2. Start and coins.
  const rooms = shuffle(Array.from({ length: cw * ch }, (_, i) => at(i % cw, Math.floor(i / cw))));
  const [sx, sy] = rooms[0];
  g[sy][sx] = "s";
  const exits = (x: number, y: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => g[y + dy][x + dx] !== "#").length;
  const dist = (a: number[], b: number[]) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
  const coins = rooms
    .slice(1)
    .sort((a, b) => exits(a[0], a[1]) - exits(b[0], b[1]) || dist(b, [sx, sy]) - dist(a, [sx, sy]))
    .filter((r) => dist(r, [sx, sy]) >= 4)
    .slice(0, coinCount);
  for (const [x, y] of coins) g[y][x] = "c";

  // 3. Holes, only where they leave every coin reachable.
  const reachesAll = () => {
    const q = [[sx, sy]];
    const got = new Set([`${sx},${sy}`]);
    while (q.length) {
      const [x, y] = q.shift()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = `${x + dx},${y + dy}`;
        const c = g[y + dy]?.[x + dx];
        if (!c || c === "#" || c === "o" || got.has(k)) continue;
        got.add(k);
        q.push([x + dx, y + dy]);
      }
    }
    return coins.every(([x, y]) => got.has(`${x},${y}`));
  };
  let holes = 0;
  // Never right next to a coin or the start (so nothing's boxed in by a
  // hole — every coin has a clear way up to it).
  const nextToCoin = (x: number, y: number) => coins.some((c) => dist(c, [x, y]) <= 1);
  const candidates = shuffle(
    g
      .flatMap((row, y) => row.map((c, x) => [x, y, c] as const))
      .filter(([x, y, c]) => c === "." && dist([x, y], [sx, sy]) > 2 && !nextToCoin(x, y)),
  );
  for (const [x, y] of candidates) {
    if (holes >= holeCount) break;
    g[y][x] = "o";
    if (reachesAll()) holes++;
    else g[y][x] = ".";
  }
  return g.map((row) => row.join(""));
}
const TILT_DEGREES = 25; // a tilt this far is full "downhill"
const GRAVITY = 0.0014;

type Pickup = { x: number; y: number; label?: number };
type Art = { marble: HTMLImageElement | null; coin: HTMLImageElement | null; wall: HTMLCanvasElement | null };

// Reads the phone's tilt as a direction (-1..1 each way). On iPhone it
// has to be allowed from a tap first (`ask`). "Level" is however the
// phone is held when the first reading comes in.
function tiltReader() {
  let base: number | null = null;
  let tilt: { x: number; y: number } | null = null;
  const onTilt = (e: DeviceOrientationEvent) => {
    if (e.gamma == null || e.beta == null) return;
    base ??= e.beta;
    const clamp = (v: number) => Math.max(-1, Math.min(1, v / TILT_DEGREES));
    tilt = { x: clamp(e.gamma), y: clamp(e.beta - base) };
  };
  let listening = false;
  const listen = () => {
    if (listening) return;
    listening = true;
    window.addEventListener("deviceorientation", onTilt);
    onStop(() => window.removeEventListener("deviceorientation", onTilt));
  };
  return {
    // Call from a tap: iPhone asks "Allow motion?"; elsewhere just listens.
    ask() {
      const D = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } })
        .DeviceOrientationEvent;
      if (D?.requestPermission) {
        D.requestPermission()
          .then((r) => r === "granted" && listen())
          .catch(() => {});
      } else listen();
    },
    get: () => tilt,
  };
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

// The maze world, shared by the celebration and the game.
async function createMarble(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  area: Area,
  onPickup: (p: Pickup) => void,
) {
  const M = await loadMatter();
  const [marble, coin, block] = await Promise.all([loadImage(MARBLE_SRC), loadImage(COIN_SRC), loadBlockArt()]);
  const art: Art = { marble, coin, wall: block ? tintBlock(block, "primary", 0.55) : null };

  const maze = generateMaze();
  const rows = maze.length;
  const cols = maze[0].length;
  const cell = Math.floor(Math.min(area.w / cols, area.h / rows));
  const ox = area.x + (area.w - cell * cols) / 2;
  const oy = area.y + (area.h - cell * rows) / 2;
  const center = (c: number, r: number) => ({ x: ox + (c + 0.5) * cell, y: oy + (r + 0.5) * cell });

  const engine = M.Engine.create({ gravity: { x: 0, y: 0, scale: GRAVITY } });
  // Walls as long blocks: horizontal runs of # first, then whatever single
  // cells are left join up into vertical runs.
  const walls: { x: number; y: number; w: number; h: number }[] = [];
  const used = maze.map((row) => [...row].map(() => false));
  maze.forEach((row, r) => {
    let start = -1;
    for (let c = 0; c <= cols; c++) {
      if (row[c] === "#" && start < 0) start = c;
      if (row[c] !== "#" && start >= 0) {
        if (c - start > 1) {
          const w = (c - start) * cell;
          walls.push({ x: ox + start * cell + w / 2, y: oy + (r + 0.5) * cell, w, h: cell });
          for (let k = start; k < c; k++) used[r][k] = true;
        }
        start = -1;
      }
    }
  });
  for (let c = 0; c < cols; c++) {
    let start = -1;
    for (let r = 0; r <= rows; r++) {
      const free = r < rows && maze[r][c] === "#" && !used[r][c];
      if (free && start < 0) start = r;
      if (!free && start >= 0) {
        const h = (r - start) * cell;
        walls.push({ x: ox + (c + 0.5) * cell, y: oy + start * cell + h / 2, w: cell, h });
        start = -1;
      }
    }
  }
  M.Composite.add(
    engine.world,
    walls.map((w) => M.Bodies.rectangle(w.x, w.y, w.w, w.h, { isStatic: true, friction: 0, restitution: 0.3, chamfer: { radius: cell * 0.2 } })),
  );

  const open: { x: number; y: number }[] = [];
  const spots: { x: number; y: number }[] = [];
  const holes: { x: number; y: number }[] = [];
  let start = center(1, 1);
  maze.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      if (ch === "#") return;
      if (ch === "o") return void holes.push(center(c, r));
      open.push(center(c, r));
      if (ch === "c") spots.push(center(c, r));
      if (ch === "s") start = center(c, r);
    }),
  );

  const radius = cell * 0.3;
  const ball = M.Bodies.circle(start.x, start.y, radius, {
    friction: 0.02,
    frictionAir: 0.012,
    restitution: 0.35,
    density: 0.002,
  });
  M.Composite.add(engine.world, ball);

  // A clack when the marble hits a wall hard.
  let lastClack = 0;
  M.Events.on(engine, "collisionStart", () => {
    const now = performance.now();
    if (ball.speed > 4 && now - lastClack > 160) {
      lastClack = now;
      void playSound("thud");
    }
  });

  const pickups: Pickup[] = [];
  // Falling into a hole: shrinks away into it, then back to the start.
  let falling: { x: number; y: number; t: number } | null = null;
  const step = (dt: number, downhill: { x: number; y: number }) => {
    if (falling) {
      falling.t += dt;
      M.Body.setPosition(ball, { x: falling.x, y: falling.y });
      M.Body.setVelocity(ball, { x: 0, y: 0 });
      if (falling.t > 0.55) {
        falling = null;
        M.Body.setPosition(ball, start);
        M.Body.setVelocity(ball, { x: 0, y: 0 });
        M.Body.setAngularVelocity(ball, 0);
      }
      return;
    }
    engine.gravity.x = downhill.x;
    engine.gravity.y = downhill.y;
    const ms = Math.min(dt, 1 / 20) * 1000;
    for (let i = 0; i < 2; i++) if (ms > 0) M.Engine.update(engine, ms / 2);
    const hole = holes.find((h) => Math.hypot(h.x - ball.position.x, h.y - ball.position.y) < cell * 0.3);
    if (hole) {
      falling = { x: hole.x, y: hole.y, t: 0 };
      void playSound("pop");
      return;
    }
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      if (Math.hypot(p.x - ball.position.x, p.y - ball.position.y) < radius + cell * 0.28) {
        pickups.splice(i, 1);
        sparkle(p.x, p.y);
        onPickup(p);
      }
    }
  };

  const coinSize = cell * 0.55;
  const draw = (time: number, arrow?: { x: number; y: number } | null) => {
    ctx.clearRect(0, 0, W, H);
    for (const h of holes) {
      const g = ctx.createRadialGradient(h.x, h.y - cell * 0.06, cell * 0.05, h.x, h.y, cell * 0.36);
      g.addColorStop(0, color("primary-strong", 0.95));
      g.addColorStop(0.75, color("primary-strong", 0.7));
      g.addColorStop(1, color("primary-strong", 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(h.x, h.y, cell * 0.38, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const w of walls) {
      ctx.save();
      ctx.translate(w.x, w.y);
      if (art.wall) drawNineSlice(ctx, art.wall, w.w, w.h, cell * 0.3);
      else {
        ctx.fillStyle = color("primary", 0.35);
        ctx.beginPath();
        ctx.roundRect(-w.w / 2, -w.h / 2, w.w, w.h, cell * 0.2);
        ctx.fill();
      }
      ctx.restore();
    }
    for (const p of pickups) {
      const bob = Math.sin(time * 3 + p.x) * 2;
      if (art.coin) ctx.drawImage(art.coin, p.x - coinSize / 2, p.y - (coinSize * COIN_ASPECT) / 2 + bob, coinSize, coinSize * COIN_ASPECT);
      if (p.label) drawLabel(ctx, `+${p.label}`, p.x, p.y + bob, 18);
    }
    // Tap-to-tilt arrow: which way the board is tipped.
    if (arrow && (arrow.x || arrow.y)) {
      const a = Math.atan2(arrow.y, arrow.x);
      ctx.save();
      ctx.translate(ball.position.x, ball.position.y);
      ctx.rotate(a);
      ctx.fillStyle = color("primary", 0.5);
      ctx.beginPath();
      ctx.moveTo(radius * 2.3, 0);
      ctx.lineTo(radius * 1.5, -radius * 0.55);
      ctx.lineTo(radius * 1.5, radius * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.translate(ball.position.x, ball.position.y);
    if (falling) {
      const k = Math.max(0, 1 - falling.t / 0.45);
      ctx.globalAlpha = k;
      ctx.scale(k, k);
    }
    ctx.rotate(ball.angle);
    if (art.marble) ctx.drawImage(art.marble, -radius, -radius, radius * 2, radius * 2);
    else {
      ctx.fillStyle = color("muted");
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  return {
    step,
    draw,
    pickups,
    spots,
    // A random open spot not right next to the marble.
    freeSpot: () => {
      const far = open.filter((o) => Math.hypot(o.x - ball.position.x, o.y - ball.position.y) > cell * 2.5);
      const pool = far.length ? far : open;
      return pool[Math.floor(Math.random() * pool.length)];
    },
    ball: () => ball.position,
    stop: () => M.Engine.clear(engine),
  };
}

// How the marble should roll this frame. A phone that allows tilt uses
// its tilt. Otherwise it's tap to tilt: a tap (or click) tips the board
// toward that spot and it stays tipped until the next tap; holding and
// dragging steers. Arrow keys tip it too.
function controls(getBall: () => { x: number; y: number }) {
  const tilt = tiltReader();
  let tipped = { x: 0, y: 0 };
  let started = false;
  const tipToward = (x: number, y: number) => {
    const b = getBall();
    const dx = x - b.x;
    const dy = y - b.y;
    const len = Math.hypot(dx, dy) || 1;
    tipped = { x: dx / len, y: dy / len };
  };
  const start = (onFirst: () => void) => {
    if (started) return;
    started = true;
    tilt.ask();
    onFirst();
  };
  return {
    input: (onFirst: () => void) =>
      gameInput({
        down: (x, y) => {
          start(onFirst);
          tipToward(x, y);
        },
        move: (x, y, pressed) => pressed && tipToward(x, y),
        key: (dir) => {
          start(onFirst);
          const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
          tipped = { x: d[0], y: d[1] };
        },
      }),
    started: () => started,
    // The real tilt wins once the phone is sending it.
    downhill: () => tilt.get() ?? tipped,
    // Which way the board is tipped by tapping (for the arrow), or null
    // when the phone's tilt is in charge.
    tapTilt: () => (tilt.get() ? null : tipped),
  };
}

// Celebration: the "+N" coins sit around the maze — tilt (or hold a
// finger) to roll the marble over them all and reveal the points. The
// marble stays put until the kid touches the screen.
export async function playMarble(opts: CelebrationOptions): Promise<void> {
  const { layer, ctx, W, H, area } = createCanvasGame("celebration");
  const chunks = pointChunks(opts.points ?? 0);
  let collected = 0;
  let revealed = false;
  let faded = false;
  const hint = hintBubble(layer, "Tilt — or tap where to roll!", area.y + 16);
  const game = await createMarble(ctx, W, H, { ...area, y: area.y + 60, h: area.h - 70 }, () => {
    collected++;
    void playSound("powerUp");
    if (collected === chunks.length && !revealed) {
      revealed = true;
      opts.onReveal?.();
      setTimeout(() => void playSound("cheer"), 150);
      void fadeOutLayer(layer, 400).then(() => (faded = true));
    }
  });
  const spots = [...game.spots].sort(() => Math.random() - 0.5);
  chunks.forEach((n, i) => game.pickups.push({ ...(spots[i] ?? game.freeSpot()), label: n }));

  const control = controls(game.ball);
  control.input(() => hint.remove());

  await new Promise<void>((finish) => {
    runLoop(layer, (dt, time) => {
      game.step(dt, control.started() ? control.downhill() : { x: 0, y: 0 });
      game.draw(time, control.tapTilt());
      if (faded) {
        finish();
        return false;
      }
    });
  });
  game.stop();
  layer.remove();
}

// "Keep playing": 45 seconds — roll over as many coins as you can (+1
// each). There are always three out; each one collected pops up somewhere
// else.
export function playMarbleGame(opts: GameOptions): () => void {
  const { layer, ctx, W, H, safe } = createCanvasGame("game");
  let score = 0;
  let stop = () => layer.remove();
  const hint = hintBubble(layer, "Tilt — or tap where to roll!", safe.y + 16);
  let game: Awaited<ReturnType<typeof createMarble>> | null = null;

  void createMarble(ctx, W, H, { ...safe, y: safe.y + 50, h: safe.h - 50 }, () => {
    opts.onScore(++score);
    void playSound("waka", 0);
    game?.pickups.push({ ...game.freeSpot() });
  }).then((g) => {
    game = g;
    for (let i = 0; i < 3; i++) g.pickups.push({ ...g.freeSpot() });
    const control = controls(g.ball);
    control.input(() => hint.remove());
    runLoop(layer, (dt, time) => {
      g.step(dt, control.started() ? control.downhill() : { x: 0, y: 0 });
      g.draw(time, control.tapTilt());
    });
    const prev = stop;
    stop = () => {
      g.stop();
      prev();
    };
  });

  onStop(() => stop());
  return () => stop();
}
