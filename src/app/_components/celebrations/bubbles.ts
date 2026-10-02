import confetti from "canvas-confetti";
import { TINTS } from "./balloons";
import { color, createCanvasGame, drawLabel, gameInput, loadImage, pointChunks, runLoop, tinted, type Area } from "./canvasGame";
import { confettiStyle, fadeOutLayer, hintBubble, onStop, type CelebrationOptions, type GameOptions } from "./shared";
import { playSound } from "./sounds";

// Bubble shooter (Puzzle Bobble style): drag to aim the shooter at the
// bottom — the dotted line shows where it'll go, bounces included — and let
// go to fire. A bubble sticks where it lands in the honeycomb at the top;
// three or more of a color touching pop, and anything left hanging from
// them drops.

const COLS = 8; // bubbles across a full row
const ORB_SRC = "/anims/orb-red.webp"; // recolored for each bubble color

type Bubble = { look: number; label?: number }; // label: "+N" (celebration)
type Fx = { x: number; y: number; look: number; t: number; vy: number; drop: boolean };
type Float = { x: number; y: number; text: string; t: number };

async function createBubbles(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  area: Area,
  opts: {
    colors: number; // how many bubble colors
    startRows: number;
    newRowEvery: number; // shots that don't pop anything before a row pushes down (0: never)
    onPop: (popped: Bubble[], dropped: Bubble[], x: number, y: number) => void;
    onFire: () => void;
    onCleared: () => void;
    onReachedBottom: () => void;
  },
) {
  const orb = await loadImage(ORB_SRC);
  // Most distinct first: red, teal, gold, blue, pink.
  const looks = [0, 3, 2, 4, 1].slice(0, opts.colors).map((k) => (orb ? tinted(orb, TINTS[k]) : null));
  const R = Math.min(area.w / (COLS * 2), 34); // bubble radius
  const rowH = R * Math.sqrt(3);
  const left = area.x + (area.w - COLS * 2 * R) / 2;
  const right = left + COLS * 2 * R;
  const top = area.y;
  const shooter = { x: (left + right) / 2, y: area.y + area.h - R * 1.4 };
  const maxRows = Math.floor((shooter.y - R * 2.2 - top) / rowH); // a row here = you're out
  const dangerY = top + R + maxRows * rowH - R;

  // The honeycomb: row i is short (COLS − 1, shifted half a bubble) when
  // (i + shift) is odd; pushing a row in from the top flips `shift`.
  let grid: (Bubble | null)[][] = [];
  let shift = 0;
  const isShort = (i: number) => (i + shift) % 2 === 1;
  const width = (i: number) => (isShort(i) ? COLS - 1 : COLS);
  const at = (i: number, c: number) => ({ x: left + R + c * 2 * R + (isShort(i) ? R : 0), y: top + R + i * rowH });
  const ensureRow = (i: number) => {
    while (grid.length <= i) grid.push(Array(width(grid.length)).fill(null));
  };
  const neighbours = (i: number, c: number): [number, number][] => {
    const d = isShort(i) ? [0, 1] : [-1, 0];
    return [
      [i, c - 1],
      [i, c + 1],
      [i - 1, c + d[0]],
      [i - 1, c + d[1]],
      [i + 1, c + d[0]],
      [i + 1, c + d[1]],
    ].filter(([a, b]) => a >= 0 && b >= 0 && b < width(a)) as [number, number][];
  };
  const get = (i: number, c: number) => grid[i]?.[c] ?? null;
  const colorsLeft = () => {
    const s = new Set<number>();
    for (const row of grid) for (const b of row) if (b) s.add(b.look);
    return [...s];
  };
  const randomLook = () => {
    const left = colorsLeft(); // only colors still on the board — no dead shots
    return left.length ? left[Math.floor(Math.random() * left.length)] : Math.floor(Math.random() * looks.length);
  };
  const fill = (rows: number) => {
    grid = [];
    shift = 0;
    for (let i = 0; i < rows; i++) {
      ensureRow(i);
      for (let c = 0; c < width(i); c++) grid[i][c] = { look: Math.floor(Math.random() * looks.length) };
    }
  };
  fill(opts.startRows);
  const pushRow = () => {
    shift = 1 - shift;
    grid.unshift(Array(width(0)).fill(null).map(() => ({ look: randomLook() })));
  };
  const lowest = () => {
    for (let i = grid.length - 1; i >= 0; i--) if (grid[i].some(Boolean)) return i;
    return -1;
  };

  // The shooter.
  let angle = -Math.PI / 2; // straight up
  let loaded = randomLook();
  let next = randomLook();
  let flying: { x: number; y: number; vx: number; vy: number; look: number } | null = null;
  let missesLeft = opts.newRowEvery;
  const fx: Fx[] = [];
  const floats: Float[] = [];
  const SPEED = R * 30;

  const aim = (x: number, y: number) => {
    const a = Math.atan2(Math.min(y - shooter.y, -R * 0.5), x - shooter.x);
    angle = Math.max(-Math.PI + 0.2, Math.min(-0.2, a)); // never flat along the floor
  };
  let paused = false;
  const fire = () => {
    if (flying || paused) return false;
    flying = { x: shooter.x, y: shooter.y, vx: Math.cos(angle) * SPEED, vy: Math.sin(angle) * SPEED, look: loaded };
    loaded = next;
    next = randomLook();
    opts.onFire();
    return true;
  };

  // Where the flying bubble sticks: the nearest free spot that hangs off
  // the ceiling or another bubble.
  const settle = (x: number, y: number, look: number) => {
    let best: [number, number] | null = null;
    let bestD = Infinity;
    const rows = Math.max(grid.length + 1, 1);
    for (let i = 0; i < rows; i++) {
      for (let c = 0; c < width(i); c++) {
        if (get(i, c)) continue;
        if (i > 0 && !neighbours(i, c).some(([a, b]) => get(a, b))) continue;
        const p = at(i, c);
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < bestD) {
          bestD = d;
          best = [i, c];
        }
      }
    }
    if (!best) return;
    const [i, c] = best;
    ensureRow(i);
    grid[i][c] = { look };

    // Same color touching: three or more pop.
    const group: [number, number][] = [[i, c]];
    const seen = new Set([`${i},${c}`]);
    for (let k = 0; k < group.length; k++)
      for (const [a, b] of neighbours(...group[k])) {
        if (seen.has(`${a},${b}`) || get(a, b)?.look !== look) continue;
        seen.add(`${a},${b}`);
        group.push([a, b]);
      }
    const p = at(i, c);
    if (group.length < 3) {
      void playSound("thud");
      if (opts.newRowEvery && --missesLeft <= 0) {
        missesLeft = opts.newRowEvery;
        pushRow();
      }
    } else {
      const popped = group.map(([a, b]) => {
        const bubble = grid[a][b]!;
        grid[a][b] = null;
        fx.push({ ...at(a, b), look: bubble.look, t: 0, vy: 0, drop: false });
        return bubble;
      });
      // Anything no longer hanging from the ceiling drops.
      const held = new Set<string>();
      const stack: [number, number][] = [];
      grid[0]?.forEach((b, k) => b && stack.push([0, k]));
      for (const [a, b] of stack) held.add(`${a},${b}`);
      while (stack.length) {
        const [a, b] = stack.pop()!;
        for (const [n, m] of neighbours(a, b))
          if (get(n, m) && !held.has(`${n},${m}`)) {
            held.add(`${n},${m}`);
            stack.push([n, m]);
          }
      }
      const dropped: Bubble[] = [];
      grid.forEach((row, a) =>
        row.forEach((b, k) => {
          if (!b || held.has(`${a},${k}`)) return;
          dropped.push(b);
          grid[a][k] = null;
          fx.push({ ...at(a, k), look: b.look, t: 0, vy: -R * 4 * Math.random(), drop: true });
        }),
      );
      void playSound("pop");
      if (dropped.length) setTimeout(() => void playSound("pop"), 120);
      confetti({
        ...confettiStyle(),
        particleCount: 14 + popped.length * 4,
        spread: 360,
        startVelocity: 14,
        ticks: 50,
        origin: { x: p.x / window.innerWidth, y: p.y / window.innerHeight },
      });
      opts.onPop(popped, dropped, p.x, p.y);
      if (lowest() < 0) opts.onCleared();
    }
    while (grid.length && !grid[grid.length - 1].some(Boolean)) grid.pop();
    if (!colorsLeft().includes(loaded)) loaded = randomLook();
    if (!colorsLeft().includes(next)) next = randomLook();
    if (lowest() >= maxRows) opts.onReachedBottom();
  };

  const step = (dt: number) => {
    if (flying) {
      // Small steps so it can't tunnel through a bubble.
      const steps = Math.ceil((SPEED * dt) / (R * 0.4));
      for (let s = 0; s < steps && flying; s++) {
        flying.x += (flying.vx * dt) / steps;
        flying.y += (flying.vy * dt) / steps;
        if (flying.x < left + R) {
          flying.x = left + R;
          flying.vx = Math.abs(flying.vx);
        } else if (flying.x > right - R) {
          flying.x = right - R;
          flying.vx = -Math.abs(flying.vx);
        }
        let hit = flying.y <= top + R;
        for (let i = 0; i < grid.length && !hit; i++)
          for (let c = 0; c < grid[i].length && !hit; c++) {
            if (!grid[i][c]) continue;
            const p = at(i, c);
            hit = Math.hypot(p.x - flying.x, p.y - flying.y) < R * 1.7;
          }
        if (hit) {
          const f = flying;
          flying = null;
          settle(f.x, f.y, f.look);
        }
      }
    }
    for (let k = fx.length - 1; k >= 0; k--) {
      const e = fx[k];
      e.t += dt;
      if (e.drop) {
        e.vy += R * 40 * dt;
        e.y += e.vy * dt;
        if (e.y > H + R) fx.splice(k, 1);
      } else if (e.t > 0.25) fx.splice(k, 1);
    }
    for (let k = floats.length - 1; k >= 0; k--) if ((floats[k].t += dt) > 1) floats.splice(k, 1);
  };

  const drawBubble = (look: number, x: number, y: number, scale = 1, label?: number) => {
    const img = looks[look];
    const s = R * 2.05 * scale;
    if (img) ctx.drawImage(img, x - s / 2, y - s / 2, s, s);
    else {
      ctx.fillStyle = color(["party-red", "party-cyan", "party-yellow", "primary", "party-pink"][look % 5]);
      ctx.beginPath();
      ctx.arc(x, y, R * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    if (label !== undefined) drawLabel(ctx, `+${label}`, x, y, Math.round(R * 0.8));
  };

  // The dotted line, bounced off the walls, up to where it'd hit.
  const drawAim = (time: number) => {
    let x = shooter.x;
    let y = shooter.y;
    let vx = Math.cos(angle);
    let vy = Math.sin(angle);
    ctx.fillStyle = color("primary", 0.5);
    const gap = R * 0.7;
    const offset = (time * R * 2) % gap; // the dots march outward
    for (let d = offset, n = 0; n < 60; n++, d = gap) {
      x += vx * d;
      y += vy * d;
      if (x < left + R) {
        x = 2 * (left + R) - x;
        vx = -vx;
      } else if (x > right - R) {
        x = 2 * (right - R) - x;
        vx = -vx;
      }
      if (y < top + R) break;
      let blocked = false;
      for (let i = 0; i < grid.length && !blocked; i++)
        for (let c = 0; c < grid[i].length && !blocked; c++) {
          if (!grid[i][c]) continue;
          const p = at(i, c);
          blocked = Math.hypot(p.x - x, p.y - y) < R * 1.7;
        }
      if (blocked) break;
      ctx.beginPath();
      ctx.arc(x, y, R * 0.13, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const draw = (time: number) => {
    ctx.clearRect(0, 0, W, H);
    // The playfield and the line the bubbles mustn't reach.
    ctx.fillStyle = color("primary", 0.06);
    ctx.beginPath();
    ctx.roundRect(left - 6, top - 6, right - left + 12, dangerY - top + 12 + R, 18);
    ctx.fill();
    ctx.strokeStyle = color("party-red", 0.45);
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(left, dangerY + R);
    ctx.lineTo(right, dangerY + R);
    ctx.stroke();
    ctx.setLineDash([]);

    grid.forEach((row, i) => row.forEach((b, c) => b && drawBubble(b.look, at(i, c).x, at(i, c).y, 1, b.label)));
    for (const e of fx) {
      if (e.drop) drawBubble(e.look, e.x, e.y);
      else {
        ctx.globalAlpha = 1 - e.t / 0.25;
        drawBubble(e.look, e.x, e.y, 1 + e.t * 2);
        ctx.globalAlpha = 1;
      }
    }

    if (!flying) drawAim(time);
    // The shooter: a ring with the loaded bubble, an arrow, and the next one.
    ctx.save();
    ctx.translate(shooter.x, shooter.y);
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = color("primary");
    ctx.beginPath();
    ctx.moveTo(0, -R * 2.1);
    ctx.lineTo(R * 0.45, -R * 1.35);
    ctx.lineTo(-R * 0.45, -R * 1.35);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = color("primary");
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(shooter.x, shooter.y, R * 1.25, 0, Math.PI * 2);
    ctx.stroke();
    drawBubble(loaded, shooter.x, shooter.y);
    drawBubble(next, shooter.x - R * 3.2, shooter.y + R * 0.4, 0.7);
    drawLabel(ctx, "next", shooter.x - R * 3.2, shooter.y - R * 0.6, 12);
    if (opts.newRowEvery) {
      // How many more shots before a row pushes down.
      for (let k = 0; k < opts.newRowEvery; k++) {
        ctx.fillStyle = k < missesLeft ? color("primary", 0.7) : color("primary", 0.15);
        ctx.beginPath();
        ctx.arc(shooter.x + R * 2.4 + k * R * 0.55, shooter.y + R * 0.4, R * 0.18, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (flying) drawBubble(flying.look, flying.x, flying.y);
    for (const f of floats) {
      ctx.globalAlpha = 1 - f.t;
      drawLabel(ctx, f.text, f.x, f.y - f.t * 40, 20);
      ctx.globalAlpha = 1;
    }
  };

  return {
    step,
    draw,
    aim,
    fire,
    shooter,
    float: (text: string, x: number, y: number) => floats.push({ text, x, y, t: 0 }),
    pause: () => (paused = true),
    // Label a few bubbles "+N" (celebration), spread over the bottom rows
    // so they're quick to reach.
    label: (chunks: number[]) => {
      const spots: Bubble[] = [];
      for (let i = grid.length - 1; i >= 0 && spots.length < chunks.length * 3; i--)
        for (const b of grid[i]) if (b) spots.push(b);
      spots.sort(() => Math.random() - 0.5);
      chunks.forEach((n, k) => spots[k] && (spots[k].label = n));
    },
    refill: (rows: number) => {
      fill(rows);
      loaded = randomLook();
      next = randomLook();
      missesLeft = opts.newRowEvery;
    },
  };
}

// Drag (or move the mouse) to aim; let go (or click) to fire. Arrow keys
// aim and ↑ fires.
function controls(game: { aim: (x: number, y: number) => void; fire: () => boolean; shooter: { x: number; y: number } }, onInput: () => void) {
  let keyAngle = -Math.PI / 2;
  return gameInput({
    down: (x, y) => {
      onInput();
      game.aim(x, y);
    },
    move: (x, y) => game.aim(x, y),
    up: (x, y) => {
      game.aim(x, y);
      game.fire();
    },
    key: (dir) => {
      onInput();
      if (dir === "up") return void game.fire();
      if (dir === "left" || dir === "right") {
        keyAngle = Math.max(-Math.PI + 0.2, Math.min(-0.2, keyAngle + (dir === "left" ? -0.08 : 0.08)));
        game.aim(game.shooter.x + Math.cos(keyAngle) * 100, game.shooter.y + Math.sin(keyAngle) * 100);
      }
    },
  });
}

// Celebration: a few rows of three colors, with the points on "+N"
// bubbles — pop them (or drop them) to collect the points.
export async function playBubbles(opts: CelebrationOptions): Promise<void> {
  const { layer, ctx, W, H, area } = createCanvasGame("celebration");
  const chunks = pointChunks(opts.points ?? 0, 4);
  let collected = 0;
  let revealed = false;
  let faded = false;
  const hint = hintBubble(layer, "Aim, let go to shoot!", area.y + area.h * 0.55);
  const board = { ...area, y: area.y + 60, h: area.h - 70 };
  const game = await createBubbles(ctx, W, H, board, {
    colors: 3,
    startRows: 4,
    newRowEvery: 0,
    onFire: () => hint.remove(),
    onPop: (popped, dropped, x, y) => {
      for (const b of [...popped, ...dropped])
        if (b.label !== undefined) {
          collected++;
          game.float(`+${b.label}`, x, y);
        }
      if (collected >= chunks.length && !revealed) {
        revealed = true;
        opts.onReveal?.();
        setTimeout(() => void playSound("cheer"), 300);
        void fadeOutLayer(layer, 900).then(() => (faded = true));
      }
    },
    onCleared: () => {
      game.refill(4);
      game.label(chunks.slice(collected));
    },
    // Stuck? A fresh board with the points still to find.
    onReachedBottom: () => {
      game.refill(4);
      game.label(chunks.slice(collected));
    },
  });
  game.label(chunks);
  controls(game, () => hint.remove());
  await new Promise<void>((finish) => {
    runLoop(layer, (dt, time) => {
      game.step(dt);
      game.draw(time);
      if (faded) {
        finish();
        return false;
      }
    });
  });
  layer.remove();
}

// "Keep playing": +1 a bubble popped, +2 for each one dropped. Every few
// shots that don't pop anything push a new row down; let the bubbles reach
// the line and you lose a heart (and get a fresh board). Clearing the
// board is +10 and a fresh one.
const LIVES = 3;
export function playBubblesGame(opts: GameOptions): () => void {
  const { layer, ctx, W, H, safe } = createCanvasGame("game");
  let score = 0;
  let lives = LIVES;
  let over = false;
  opts.onLives?.(lives);
  let stop = () => layer.remove();
  const hint = hintBubble(layer, "Aim, let go to shoot!", safe.y + safe.h * 0.55);
  let game: Awaited<ReturnType<typeof createBubbles>> | null = null;

  void createBubbles(ctx, W, H, safe, {
    colors: 4,
    startRows: 5,
    newRowEvery: 7,
    onFire: () => hint.remove(),
    onPop: (popped, dropped, x, y) => {
      const won = popped.length + dropped.length * 2;
      opts.onScore((score += won));
      game?.float(`+${won}`, x, y);
    },
    onCleared: () => {
      opts.onScore((score += 10));
      void playSound("powerUp");
      game?.float("Cleared! +10", W / 2, safe.y + safe.h * 0.4);
      setTimeout(() => game?.refill(5), 600);
    },
    onReachedBottom: () => {
      if (over) return;
      void playSound("boom");
      opts.onLives?.(--lives);
      if (lives <= 0) {
        over = true;
        game?.pause();
        opts.onGameOver?.();
      } else game?.refill(5);
    },
  }).then((g) => {
    game = g;
    controls(g, () => hint.remove());
    runLoop(layer, (dt, time) => {
      g.step(dt);
      g.draw(time);
    });
  });

  onStop(() => stop());
  return () => stop();
}
