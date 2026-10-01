import confetti from "canvas-confetti";
import {
  color,
  createCanvasGame,
  drawLabel,
  gameInput,
  idleTracker,
  loadImage,
  pointChunks,
  runLoop,
} from "./canvasGame";
import { confettiStyle, hintBubble, onStop, type CelebrationOptions, type GameOptions } from "./shared";
import { playSound } from "./sounds";

// Artwork slots. The chomper is drawn facing right, mouth open and mouth
// closed (it flips to face where it's going). Until it exists, the kid's
// avatar is cut into a pac-man shape. The ghost is drawn facing forward
// (tinted per ghost); until it exists, ghosts are drawn with shapes.
const CHOMPER_OPEN_SRC: string | undefined = undefined; // e.g. "/anims/chomper-open.webp"
const CHOMPER_CLOSED_SRC: string | undefined = undefined; // e.g. "/anims/chomper-closed.webp"
const GHOST_SRC: string | undefined = undefined; // e.g. "/anims/ghost.webp"
const DOT_SRC = "/anims/orb-pearl.webp"; // regular dots
const BIG_DOT_SRC = "/anims/orb-gold.webp"; // power dots and "+N" dots

type DotArt = { dot: HTMLImageElement | null; big: HTMLImageElement | null };
async function loadDotArt(): Promise<DotArt> {
  const [dot, big] = await Promise.all([loadImage(DOT_SRC), loadImage(BIG_DOT_SRC)]);
  return { dot, big };
}
function drawDot(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, x: number, y: number, r: number, fallback: string) {
  if (img) ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
  else {
    ctx.fillStyle = color(fallback);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

type ChomperArt = {
  open: HTMLImageElement | null;
  closed: HTMLImageElement | null;
  avatar: HTMLImageElement | null;
};
async function loadChomperArt(avatarSrc: string): Promise<ChomperArt> {
  const [open, closed] = await Promise.all([loadImage(CHOMPER_OPEN_SRC), loadImage(CHOMPER_CLOSED_SRC)]);
  return { open, closed, avatar: open ? null : await loadImage(avatarSrc) };
}

// # wall   . dot   o power dot   G ghost house (no dots)   P start
const MAZE = [
  "#########",
  "#o.....o#",
  "#.##.##.#",
  "#.#...#.#",
  "#...#...#",
  "###.#.###",
  "#...G...#",
  "#.#GGG#.#",
  "#.......#",
  "#.##.##.#",
  "#o..P..o#",
  "#########",
];
const ROWS = MAZE.length;
const COLS = MAZE[0].length;
const GHOST_COLORS = ["party-red", "party-pink", "party-cyan"];
const SCARED_SECONDS = 6;

type Dir = { dc: number; dr: number };
const DIRS: Record<"up" | "down" | "left" | "right", Dir> = {
  up: { dc: 0, dr: -1 },
  down: { dc: 0, dr: 1 },
  left: { dc: -1, dr: 0 },
  right: { dc: 1, dr: 0 },
};

// Moves tile to tile; `t` is progress (0..1) from (c, r) toward (tc, tr).
type Mover = { c: number; r: number; tc: number; tr: number; t: number; dir: Dir; speed: number };

const isWall = (c: number, r: number) => MAZE[r]?.[c] === "#" || MAZE[r]?.[c] === undefined;
const findTile = (ch: string) => {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (MAZE[r][c] === ch) return { c, r };
  return { c: 1, r: 1 };
};

function step(m: Mover, dt: number, choose: (m: Mover) => Dir | null) {
  let budget = m.speed * dt;
  while (budget > 0) {
    if (m.c === m.tc && m.r === m.tr) {
      // At a tile center: pick where to go next.
      const d = choose(m);
      if (!d || isWall(m.c + d.dc, m.r + d.dr)) return;
      m.dir = d;
      m.tc = m.c + d.dc;
      m.tr = m.r + d.dr;
      m.t = 0;
    }
    const use = Math.min(budget, 1 - m.t);
    m.t += use;
    budget -= use;
    if (m.t >= 1) {
      m.c = m.tc;
      m.r = m.tr;
      m.t = 0;
    }
  }
}
const pos = (m: Mover) => ({ c: m.c + (m.tc - m.c) * m.t, r: m.r + (m.tr - m.r) * m.t });

// Draws the chomper facing `angle`, chomping: the artwork if there is
// some, else the avatar with a pac-man mouth.
function drawChomper(
  ctx: CanvasRenderingContext2D,
  art: ChomperArt | null,
  x: number,
  y: number,
  size: number,
  angle: number,
  time: number,
) {
  if (art?.open) {
    const frame = Math.sin(time * 18) > 0 || !art.closed ? art.open : art.closed;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    if (Math.cos(angle) < -0.1) ctx.scale(1, -1); // facing left: flip, don't go upside down
    ctx.drawImage(frame, -size / 2, -size / 2, size, size);
    ctx.restore();
    return;
  }
  const avatar = art?.avatar ?? null;
  const mouth = (Math.sin(time * 18) * 0.5 + 0.5) * 0.7 + 0.05; // radians, opening/closing
  const r = size / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, r, mouth, Math.PI * 2 - mouth);
  ctx.closePath();
  ctx.clip();
  ctx.rotate(-angle); // keep the avatar upright inside the mouth shape
  if (avatar) ctx.drawImage(avatar, -r, -r, size, size);
  else {
    ctx.fillStyle = color("party-yellow");
    ctx.fillRect(-r, -r, size, size);
  }
  ctx.restore();
}

function drawGhost(
  ctx: CanvasRenderingContext2D,
  art: HTMLImageElement | null,
  x: number,
  y: number,
  size: number,
  tint: string,
  scared: boolean,
  time: number,
) {
  const r = size / 2;
  ctx.save();
  ctx.translate(x, y);
  if (scared) ctx.globalAlpha = 0.75 + Math.sin(time * 20) * 0.2;
  if (art) {
    ctx.drawImage(art, -r, -r, size, size);
  } else {
    ctx.fillStyle = color(scared ? "accent" : tint);
    ctx.beginPath();
    ctx.arc(0, -r * 0.1, r * 0.9, Math.PI, 0);
    // Wavy skirt.
    const waves = 3;
    for (let i = 0; i <= waves * 2; i++) {
      const wx = r * 0.9 - (i / (waves * 2)) * r * 1.8;
      const wy = r * 0.8 + (i % 2 ? -r * 0.18 : 0) + Math.sin(time * 10 + i) * 2;
      ctx.lineTo(wx, wy);
    }
    ctx.closePath();
    ctx.fill();
    for (const side of [-1, 1]) {
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(side * r * 0.32, -r * 0.2, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color("primary-strong");
      ctx.beginPath();
      ctx.arc(side * r * 0.32, -r * 0.14, r * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function crumbs(x: number, y: number, n = 14) {
  confetti({
    ...confettiStyle(),
    particleCount: n,
    spread: 360,
    startVelocity: 12,
    ticks: 50,
    origin: { x: x / window.innerWidth, y: y / window.innerHeight },
  });
}

// Celebration: a mini maze with two turns. The chomper runs along the
// corridor gobbling dots and waits at each corner for a tap ("Tap to
// turn!"). After the second turn it chomps the last "+N" dots and the
// points are revealed. If nobody taps, it turns by itself after a moment.
export async function playChomper(opts: CelebrationOptions): Promise<void> {
  const { layer, ctx, W, H, area } = createCanvasGame("celebration");
  const [art, dotArt] = await Promise.all([loadChomperArt(opts.avatarSrc), loadDotArt()]);
  const size = Math.min(W * 0.16, 64);

  // Right → down → right: start, corner 1, corner 2, exit.
  const y1 = area.y + area.h * 0.28;
  const y2 = area.y + area.h * 0.62;
  const xTurn = W * 0.62;
  const path = [
    { x: area.x + size * 0.6, y: y1 },
    { x: xTurn, y: y1 },
    { x: xTurn, y: y2 },
    { x: W + size * 2, y: y2 },
  ];
  const segLen = (i: number) => Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y);
  const total = [0, 1, 2].reduce((sum, i) => sum + segLen(i), 0);
  const pointAt = (d: number) => {
    for (let i = 0; i < 3; i++) {
      const L = segLen(i);
      if (d <= L || i === 2) {
        const k = Math.min(1, d / L);
        return {
          x: path[i].x + (path[i + 1].x - path[i].x) * k,
          y: path[i].y + (path[i + 1].y - path[i].y) * k,
          seg: i,
        };
      }
      d -= L;
    }
    return { ...path[3], seg: 2 };
  };

  // Dots along the corridor (up to the right edge); "+N" on the last few.
  const visible = total - size * 2;
  const DOTS = Math.floor(visible / 30);
  const dots: { d: number; x: number; y: number; label?: number; eaten: boolean }[] = [];
  for (let i = 1; i <= DOTS; i++) {
    const d = (i / (DOTS + 1)) * visible;
    const p = pointAt(d);
    dots.push({ d, x: p.x, y: p.y, eaten: false });
  }
  const chunks = pointChunks(opts.points ?? 0, 4);
  const lastLeg = dots.filter((d) => pointAt(d.d).seg === 2);
  chunks.forEach((n, k) => {
    const dot = lastLeg[Math.round(((k + 1) * lastLeg.length) / chunks.length) - 1];
    if (dot) dot.label = n;
  });

  const corners = [segLen(0), segLen(0) + segLen(1)];
  let d = 0;
  let waitingAt: number | null = null; // index of the corner we're waiting at
  let tapped = false;
  let hint: HTMLElement | null = null;
  const idle = idleTracker(2500);
  gameInput({
    down: () => {
      tapped = true;
      idle.poke();
    },
  });

  let revealed = false;
  await new Promise<void>((done) =>
    runLoop(layer, (dt, time) => {
      if (waitingAt === null) {
        const next = corners.find((c) => c > d);
        d = Math.min(d + dt * W * 0.45, next ?? Infinity);
        if (next !== undefined && d >= next) {
          waitingAt = corners.indexOf(next);
          tapped = false;
          idle.poke();
          const p = pointAt(d);
          hint = hintBubble(layer, "Tap to turn!", Math.max(area.y, p.y - size * 1.6));
        }
      } else if (tapped || idle.idle()) {
        waitingAt = null;
        hint?.remove();
        void playSound("pop");
        d += 1; // nudge past the corner
      }

      for (const dot of dots) {
        if (!dot.eaten && d >= dot.d) {
          dot.eaten = true;
          if (dot.label) {
            void playSound("pop");
            crumbs(dot.x, dot.y, 20);
          }
        }
      }
      if (!revealed && dots.every((x) => x.eaten)) {
        revealed = true;
        opts.onReveal?.();
        void playSound("cheer");
        // Clear the maze off the points screen.
        layer
          .animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: "forwards" })
          .finished.then(() => {
            done();
          });
      }

      // Corridor walls: a wide lavender stroke with the path cut out.
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      path.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.strokeStyle = color("primary", 0.25);
      ctx.lineWidth = size * 1.6;
      ctx.stroke();
      ctx.strokeStyle = color("soft");
      ctx.lineWidth = size * 1.25;
      ctx.stroke();
      ctx.restore();

      for (const dot of dots) {
        if (dot.eaten) continue;
        if (dot.label) drawDot(ctx, dotArt.big, dot.x, dot.y, 11, "party-yellow");
        else drawDot(ctx, dotArt.dot, dot.x, dot.y, 6, "party-yellow");
        if (dot.label) drawLabel(ctx, `+${dot.label}`, dot.x, dot.y - 24);
      }

      const p = pointAt(d);
      const angle = p.seg === 1 && waitingAt !== 0 ? Math.PI / 2 : 0; // facing down on the middle leg
      drawChomper(ctx, art, p.x, p.y, size, angle, waitingAt === null ? time : 0);

      if (d >= total && !revealed) {
        done();
        return false;
      }
    }),
  );
  layer.remove();
}

// "Keep playing": swipe to steer through the maze, eat dots (+1). Power dots
// scare the ghosts for a few seconds — eat them for +5. Three lives: each
// catch costs one, and the last one is game over. Clearing the maze
// refills it.
export function playChomperGame(opts: GameOptions): () => void {
  const { layer, ctx, W, H, area } = createCanvasGame("game");
  let art: ChomperArt | null = null;
  let ghostArt: HTMLImageElement | null = null;
  void loadChomperArt(opts.avatarSrc).then((a) => (art = a));
  void loadImage(GHOST_SRC).then((i) => (ghostArt = i));
  let dotArt: DotArt = { dot: null, big: null };
  void loadDotArt().then((a) => (dotArt = a));

  const S = Math.floor(Math.min(area.w / COLS, area.h / ROWS));
  const ox = area.x + (area.w - S * COLS) / 2;
  const oy = area.y + (area.h - S * ROWS) / 2;
  const px = (c: number) => ox + c * S + S / 2;
  const py = (r: number) => oy + r * S + S / 2;

  let score = 0;
  let lives = 3;
  opts.onLives?.(lives);
  let scaredFor = 0;
  let safeFor = 1; // brief invulnerability after (re)spawning
  const dots = new Map<string, "dot" | "power">();
  const fillDots = () => {
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        if (MAZE[r][c] === ".") dots.set(`${c},${r}`, "dot");
        if (MAZE[r][c] === "o") dots.set(`${c},${r}`, "power");
      }
  };
  fillDots();

  const start = findTile("P");
  const home = findTile("G");
  const newMover = (at: { c: number; r: number }, speed: number): Mover => ({
    c: at.c,
    r: at.r,
    tc: at.c,
    tr: at.r,
    t: 0,
    dir: DIRS.left,
    speed,
  });
  const chomper = newMover(start, 4.2);
  let queued: Dir | null = null;
  const ghosts = GHOST_COLORS.map((tint, i) => ({
    m: newMover({ c: home.c - 1 + i, r: home.r + 1 }, 2.6 + i * 0.25),
    tint,
    releaseIn: 1 + i * 2,
  }));

  // Swipe (or arrow keys) to queue a direction.
  let swipeFrom: { x: number; y: number } | null = null;
  const turn = (dx: number, dy: number) => {
    queued = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? DIRS.right : DIRS.left) : dy > 0 ? DIRS.down : DIRS.up;
  };
  gameInput({
    down: (x, y) => (swipeFrom = { x, y }),
    move: (x, y, pressed) => {
      if (!pressed || !swipeFrom) return;
      const dx = x - swipeFrom.x;
      const dy = y - swipeFrom.y;
      if (Math.hypot(dx, dy) > 24) {
        turn(dx, dy);
        swipeFrom = { x, y };
      }
    },
    up: (x, y) => {
      // A plain tap turns toward the tap, relative to the chomper.
      if (swipeFrom && Math.hypot(x - swipeFrom.x, y - swipeFrom.y) <= 24) {
        const p = pos(chomper);
        turn(x - px(p.c), y - py(p.r));
      }
      swipeFrom = null;
    },
    key: (dir) => (queued = DIRS[dir]),
  });

  const chooseChomper = (m: Mover): Dir | null => {
    if (queued && !isWall(m.c + queued.dc, m.r + queued.dr)) return queued;
    if (!isWall(m.c + m.dir.dc, m.r + m.dir.dr)) return m.dir;
    return null;
  };
  const chooseGhost = (m: Mover): Dir | null => {
    const options = Object.values(DIRS).filter(
      (d) => !isWall(m.c + d.dc, m.r + d.dr) && !(d.dc === -m.dir.dc && d.dr === -m.dir.dr),
    );
    if (options.length === 0) return { dc: -m.dir.dc, dr: -m.dir.dr }; // dead end: turn back
    const dist = (d: Dir) => Math.hypot(m.c + d.dc - chomper.c, m.r + d.dr - chomper.r);
    options.sort((a, b) => dist(a) - dist(b));
    if (scaredFor > 0) return options[options.length - 1]; // run away
    return Math.random() < 0.65 ? options[0] : options[Math.floor(Math.random() * options.length)];
  };

  runLoop(layer, (dt, time) => {
    scaredFor = Math.max(0, scaredFor - dt);
    safeFor = Math.max(0, safeFor - dt);

    const before = { c: chomper.c, r: chomper.r };
    step(chomper, dt, chooseChomper);
    if (chomper.c !== before.c || chomper.r !== before.r || chomper.t === 0) {
      const key = `${chomper.c},${chomper.r}`;
      const dot = dots.get(key);
      if (dot) {
        dots.delete(key);
        opts.onScore(++score);
        void playSound("pop");
        if (dot === "power") {
          scaredFor = SCARED_SECONDS;
          crumbs(px(chomper.c), py(chomper.r), 24);
        }
        if (dots.size === 0) {
          void playSound("cheer");
          fillDots();
        }
      }
    }

    for (const g of ghosts) {
      if (g.releaseIn > 0) {
        g.releaseIn -= dt;
        continue;
      }
      g.m.speed = scaredFor > 0 ? 1.8 : 2.6;
      step(g.m, dt, chooseGhost);
      const a = pos(g.m);
      const b = pos(chomper);
      if (Math.hypot(a.c - b.c, a.r - b.r) < 0.6) {
        if (scaredFor > 0) {
          // Chomp the ghost: +5, and it goes home.
          score += 5;
          opts.onScore(score);
          void playSound("boom");
          crumbs(px(a.c), py(a.r), 30);
          Object.assign(g.m, newMover({ c: home.c, r: home.r + 1 }, g.m.speed));
          g.releaseIn = 2;
        } else if (safeFor === 0) {
          // Caught — lose a life and go back to start.
          lives -= 1;
          opts.onLives?.(lives);
          void playSound("boom");
          if (lives <= 0) {
            opts.onGameOver?.();
            return false;
          }
          Object.assign(chomper, newMover(start, chomper.speed));
          queued = null;
          safeFor = 1.5;
        }
      }
    }

    // Draw.
    ctx.clearRect(0, 0, W, H);
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        if (MAZE[r][c] !== "#") continue;
        ctx.fillStyle = color("primary", 0.18);
        ctx.beginPath();
        ctx.roundRect(ox + c * S + 2, oy + r * S + 2, S - 4, S - 4, S * 0.25);
        ctx.fill();
      }
    for (const [key, kind] of dots) {
      const [c, r] = key.split(",").map(Number);
      if (kind === "power") drawDot(ctx, dotArt.big, px(c), py(r), S * 0.24 + Math.sin(time * 6) * 2, "party-pink");
      else drawDot(ctx, dotArt.dot, px(c), py(r), S * 0.12, "party-yellow");
    }
    for (const g of ghosts) {
      const p = pos(g.m);
      drawGhost(ctx, ghostArt, px(p.c), py(p.r), S * 0.9, g.tint, scaredFor > 0, time);
    }
    const p = pos(chomper);
    const angle = Math.atan2(chomper.dir.dr, chomper.dir.dc);
    if (safeFor === 0 || Math.floor(time * 10) % 2 === 0) {
      drawChomper(ctx, art, px(p.c), py(p.r), S * 0.95, angle, time);
    }
  });

  const stop = () => layer.remove();
  onStop(stop);
  return stop;
}
