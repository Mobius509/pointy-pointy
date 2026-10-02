import confetti from "canvas-confetti";
import { TINTS } from "./balloons";
import { roundSpec, SHAPES, SPECIAL_INFO, UNLOCK_ORDER, type SpecialKind } from "./bubbleLevels";
import { color, createCanvasGame, drawLabel, gameInput, loadImage, pointChunks, runLoop, tinted, type Area } from "./canvasGame";
import {
  confettiStyle,
  devMode,
  devPanel,
  fadeOutLayer,
  hintBubble,
  onStop,
  type CelebrationOptions,
  type GameOptions,
} from "./shared";
import { playSound } from "./sounds";

// Bubble shooter (Puzzle Bobble style): drag to aim the shooter at the
// bottom — the dotted line shows where it'll go, bounces included — and let
// go to fire. A bubble sticks where it lands in the honeycomb at the top;
// three or more of a color touching pop, and anything left hanging from
// them drops. Tap the "next" bubble to swap it in.
//
// Keep playing is one game against rows coming down faster and faster;
// each cleared board is a new level (bubbleLevels.ts): a new shape, more
// colors, a shorter aim line and a new kind of special bubble. Shiny pearls
// earn power shots.

const COLS = 8; // bubbles across a full row
const ORB_SRC = "/anims/orb-red.webp"; // recolored for each bubble color
const PEARL_SRC = "/anims/orb-pearl.webp"; // the colorless specials sit on this

type Kind = "normal" | SpecialKind;
type Bubble = { look: number; kind: Kind; iced?: boolean; chained?: boolean; label?: number }; // label: "+N" (celebration)
type Power = "fire" | "rainbow" | "bomb" | "triple";
const POWERS: Power[] = ["fire", "rainbow", "bomb", "triple"];
const POWER_INFO: Record<Power, { icon: string; name: string }> = {
  fire: { icon: "🔥", name: "Fireball" },
  rainbow: { icon: "🌈", name: "Rainbow shot" },
  bomb: { icon: "💣", name: "Bomb shot" },
  triple: { icon: "✳️", name: "Triple shot" },
};
type Shot = { look: number; power?: Power };
type Cell = [number, number];
type Fx = { x: number; y: number; b: Bubble; t: number; vy: number; drop: boolean };
type Float = { text: string; x: number; y: number; t: number; size: number; life: number };
type Flyer = { x: number; y: number; vx: number; vy: number; shot: Shot; burned?: { cells: Set<string>; popped: Bubble[] } };

// Kinds that have a color (and so can match); the rest are colorless.
const COLORED = new Set<Kind>(["normal", "pearl", "prize", "ice", "chained"]);
// Colorless specials that go off when a shot lands next to them…
const CONTACT = new Set<Kind>(["star", "skull", "ghost", "bomb", "lightning"]);
// …and the ones that also go off when a popping group touches them.
const NEXT_TO_POP = new Set<Kind>(["skull", "ghost", "bomb", "lightning"]);
const EMOJI: Partial<Record<Kind, string>> = {
  rainbow: "🌈",
  star: "⭐",
  bomb: "💣",
  lightning: "⚡",
  skull: "💀",
  ghost: "👻",
  prize: "🎁",
  chained: "🔒",
};
const POINTS = { pop: 1, drop: 2, prize: 5, stone: 3 };
const GHOST_CYCLE = 3.5; // seconds: there for 2, gone for 1.5
const GHOST_SHOWN = 2;

type TurnResult = { points: number; labels: number[]; x: number; y: number };

async function createBubbles(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  area: Area,
  opts: {
    onTurn: (r: TurnResult) => void;
    onFire: () => void;
    onCleared: () => void;
    onReachedBottom: () => void;
  },
) {
  const [orb, pearl] = await Promise.all([loadImage(ORB_SRC), loadImage(PEARL_SRC)]);
  // Most distinct first: red, teal, gold, blue, pink.
  const looks = [0, 3, 2, 4, 1].map((k) => (orb ? tinted(orb, TINTS[k]) : null));
  const stoneImg = orb ? tinted(orb, "grayscale(1) brightness(0.8)") : null;
  const R = Math.min(area.w / (COLS * 2), 34); // bubble radius
  const rowH = R * Math.sqrt(3);
  const left = area.x + (area.w - COLS * 2 * R) / 2;
  const right = left + COLS * 2 * R;
  const top = area.y;
  const shooter = { x: (left + right) / 2, y: area.y + area.h - R * 1.4 };
  const nextAt = { x: shooter.x - R * 3.2, y: shooter.y + R * 0.4 };
  const maxRows = Math.floor((shooter.y - R * 2.2 - top) / rowH); // a row here = you're out
  const dangerY = top + R + maxRows * rowH - R;

  // Settings for the current board.
  let colors = 3;
  let newRowEvery = 0; // misses before a row pushes down (0: not by misses)
  let rowEvery = 0; // …or seconds between rows (0: not on a clock)
  let rowClock = 0;
  let aimFrac = 1;

  // The honeycomb: row i is short (COLS − 1, shifted half a bubble) when
  // (i + shift) is odd; pushing a row in from the top flips `shift`.
  let grid: (Bubble | null)[][] = [];
  let shift = 0;
  const isShort = (i: number) => (i + shift) % 2 === 1;
  const width = (i: number) => (isShort(i) ? COLS - 1 : COLS);
  const at = (i: number, c: number) => ({ x: left + R + c * 2 * R + (isShort(i) ? R : 0), y: top + R + i * rowH });
  const key = (i: number, c: number) => `${i},${c}`;
  const ensureRow = (i: number) => {
    while (grid.length <= i) grid.push(Array(width(grid.length)).fill(null));
  };
  const neighbours = (i: number, c: number): Cell[] => {
    const d = isShort(i) ? [0, 1] : [-1, 0];
    return (
      [
        [i, c - 1],
        [i, c + 1],
        [i - 1, c + d[0]],
        [i - 1, c + d[1]],
        [i + 1, c + d[0]],
        [i + 1, c + d[1]],
      ] as Cell[]
    ).filter(([a, b]) => a >= 0 && b >= 0 && b < width(a));
  };
  const get = (i: number, c: number) => grid[i]?.[c] ?? null;
  const cells = (): Cell[] => grid.flatMap((row, i) => row.flatMap((b, c) => (b ? [[i, c] as Cell] : [])));
  let clock = 0;
  const ghostShown = () => clock % GHOST_CYCLE < GHOST_SHOWN;
  const solid = (b: Bubble | null) => !!b && (b.kind !== "ghost" || ghostShown()); // shots hit it

  const colorsLeft = () => {
    const s = new Set<number>();
    for (const row of grid) for (const b of row) if (b && COLORED.has(b.kind)) s.add(b.look);
    return [...s];
  };
  const randomLook = () => {
    const left = colorsLeft(); // only colors still on the board — no dead shots
    return left.length ? left[Math.floor(Math.random() * left.length)] : Math.floor(Math.random() * colors);
  };
  const lowest = () => {
    for (let i = grid.length - 1; i >= 0; i--) if (grid[i].some(Boolean)) return i;
    return -1;
  };
  // Cells no longer hanging from the top row.
  const floating = (): Cell[] => {
    const held = new Set<string>();
    const stack: Cell[] = [];
    grid[0]?.forEach((b, c) => b && stack.push([0, c]));
    for (const [a, b] of stack) held.add(key(a, b));
    while (stack.length) {
      const [a, b] = stack.pop()!;
      for (const [n, m] of neighbours(a, b))
        if (get(n, m) && !held.has(key(n, m))) {
          held.add(key(n, m));
          stack.push([n, m]);
        }
    }
    return cells().filter(([i, c]) => !held.has(key(i, c)));
  };

  // The shooter.
  let angle = -Math.PI / 2; // straight up
  let loaded: Shot = { look: 0 };
  let next: Shot = { look: 0 };
  let pending: Power[] = []; // power shots waiting for a free slot
  let flying: Flyer[] = [];
  let missesLeft = 0;
  let paused = false;
  const fx: Fx[] = [];
  const floats: Float[] = [];
  const SPEED = R * 30;
  const float = (text: string, x: number, y: number, size = 20, life = 1) => floats.push({ text, x, y, t: 0, size, life });

  // A board from a shape: colors clump a little (so there are groups to
  // pop), then the specials go on top.
  const build = (shape: string[], specials: SpecialKind[]) => {
    grid = [];
    shift = 0;
    const rows = Math.min(shape.length, maxRows - 4);
    for (let i = 0; i < rows; i++) {
      ensureRow(i);
      for (let c = 0; c < width(i); c++) {
        if (shape[i]?.[c] !== "#") continue;
        const near = [get(i, c - 1), ...neighbours(i, c).filter(([a]) => a < i).map(([a, b]) => get(a, b))].filter(
          (b): b is Bubble => !!b,
        );
        const copy = near.length && Math.random() < 0.5 ? near[Math.floor(Math.random() * near.length)] : null;
        grid[i][c] = { look: copy ? copy.look : Math.floor(Math.random() * colors), kind: "normal" };
      }
    }
    for (const [i, c] of floating()) grid[i][c] = null;
    const spots = cells().sort(() => Math.random() - 0.5);
    specials.forEach((k, n) => {
      const spot = spots[n];
      if (!spot) return;
      const b = grid[spot[0]][spot[1]]!;
      b.kind = k;
      if (k === "ice") b.iced = true;
      if (k === "chained") b.chained = true;
    });
    while (grid.length && !grid[grid.length - 1].some(Boolean)) grid.pop();
    flying = [];
    pending = [];
    paused = false;
    missesLeft = newRowEvery;
    rowClock = 0;
    loaded = { look: randomLook() };
    next = { look: randomLook() };
  };

  const pushRow = () => {
    shift = 1 - shift;
    grid.unshift(
      Array(width(0))
        .fill(null)
        .map((): Bubble => ({ look: randomLook(), kind: "normal" })),
    );
  };

  const aim = (x: number, y: number) => {
    const a = Math.atan2(Math.min(y - shooter.y, -R * 0.5), x - shooter.x);
    angle = Math.max(-Math.PI + 0.2, Math.min(-0.2, a)); // never flat along the floor
  };
  const launch = (shot: Shot, a: number): Flyer => {
    const f = { x: shooter.x, y: shooter.y, vx: Math.cos(a) * SPEED, vy: Math.sin(a) * SPEED, shot };
    flying.push(f);
    return f;
  };
  const fire = () => {
    if (flying.length || paused) return false;
    const shot = loaded;
    if (shot.power === "triple") for (const d of [-0.13, 0, 0.13]) launch({ look: shot.look }, angle + d);
    else {
      const f = launch(shot, angle);
      if (shot.power === "fire") f.burned = { cells: new Set(), popped: [] };
    }
    loaded = next;
    next = pending.length ? { look: randomLook(), power: pending.shift() } : { look: randomLook() };
    opts.onFire();
    return true;
  };
  const swap = () => {
    if (flying.length || paused) return;
    [loaded, next] = [next, loaded];
    void playSound("flap");
  };
  const nearNext = (x: number, y: number) => Math.hypot(x - nextAt.x, y - nextAt.y) < R * 1.6;
  const award = (power: Power) => {
    if (!next.power) next = { ...next, power };
    else pending.push(power);
    void playSound("powerUp");
    float(`${POWER_INFO[power].icon} ${POWER_INFO[power].name}!`, nextAt.x + R * 2, nextAt.y - R * 2.4, 16, 1.6);
  };

  const matches = (b: Bubble | null, look: number) =>
    !!b && (b.kind === "rainbow" || (COLORED.has(b.kind) && !b.chained && b.look === look));
  const groupFrom = (i: number, c: number, look: number): Cell[] => {
    const group: Cell[] = [[i, c]];
    const seen = new Set([key(i, c)]);
    for (let k = 0; k < group.length; k++)
      for (const [a, b] of neighbours(...group[k])) {
        if (seen.has(key(a, b)) || !matches(get(a, b), look)) continue;
        seen.add(key(a, b));
        group.push([a, b]);
      }
    return group;
  };

  // Free cells around a spot that a new bubble could hang in, nearest first.
  const freeAround = (i: number, c: number, n: number): Cell[] => {
    const out: Cell[] = [];
    const seen = new Set([key(i, c)]);
    const queue: Cell[] = [[i, c]];
    while (queue.length && out.length < n) {
      const [a, b] = queue.shift()!;
      for (const [x, y] of neighbours(a, b)) {
        if (seen.has(key(x, y)) || x > maxRows) continue;
        seen.add(key(x, y));
        queue.push([x, y]);
        if (!get(x, y) && (x === 0 || neighbours(x, y).some(([p, q]) => get(p, q)))) out.push([x, y]);
      }
    }
    return out.slice(0, n);
  };

  // Pops the cells, following chain reactions: bombs blast their
  // neighbours, lightning its row; skulls and ghosts that go off spawn new
  // bubbles around them (unless `burn` — a fireball or bomb shot just
  // destroys them). Ice cracks instead of popping.
  const blow = (start: Cell[], burn = false): Bubble[] => {
    const marked = new Map<string, Cell>();
    const queue: Cell[] = [];
    const mark = ([i, c]: Cell) => {
      if (!get(i, c) || marked.has(key(i, c))) return;
      marked.set(key(i, c), [i, c]);
      queue.push([i, c]);
    };
    start.forEach(mark);
    const spawns: Cell[] = [];
    let boom = false;
    while (queue.length) {
      const [i, c] = queue.shift()!;
      const b = get(i, c)!;
      if (b.kind === "bomb") {
        boom = true;
        neighbours(i, c).forEach(mark);
      } else if (b.kind === "lightning") {
        boom = true;
        grid[i].forEach((_, k) => mark([i, k]));
      } else if ((b.kind === "skull" || b.kind === "ghost") && !burn) spawns.push([i, c]);
    }
    const popped: Bubble[] = [];
    for (const [i, c] of marked.values()) {
      const b = grid[i][c]!;
      const p = at(i, c);
      if (b.iced) {
        b.iced = false; // cracked — the next match pops it
        float("crack!", p.x, p.y, 13, 0.6);
        continue;
      }
      grid[i][c] = null;
      popped.push(b);
      fx.push({ ...p, b, t: 0, vy: 0, drop: false });
    }
    // A pop next to a chained bubble frees it.
    for (const [i, c] of marked.values())
      if (!get(i, c))
        for (const [a, d] of neighbours(i, c)) {
          const n = get(a, d);
          if (n?.chained) n.chained = false;
        }
    // 💀 👻 more bubbles, in random colors.
    for (const [i, c] of spawns) {
      const p = at(i, c);
      for (const [a, d] of freeAround(i, c, 3 + Math.floor(Math.random() * 3))) {
        ensureRow(a);
        grid[a][d] = { look: Math.floor(Math.random() * colors), kind: "normal" };
      }
      float("More bubbles!", p.x, p.y, 15, 1.2);
    }
    if (boom) void playSound("explode");
    if (spawns.length) void playSound("boom");
    return popped;
  };

  // After a shot: drop what's left hanging, add up the points and rewards,
  // and check for a cleared board or bubbles over the line.
  const finishTurn = (popped: Bubble[], x: number, y: number) => {
    const scored = popped.filter((b) => b.kind !== "skull" && b.kind !== "ghost");
    if (!scored.length) {
      void playSound("thud");
      if (newRowEvery && --missesLeft <= 0) {
        missesLeft = newRowEvery;
        pushRow();
      }
    }
    const dropped: Bubble[] = [];
    const drop = ([i, c]: Cell) => {
      const b = grid[i][c]!;
      grid[i][c] = null;
      dropped.push(b);
      fx.push({ ...at(i, c), b, t: 0, vy: -R * 4 * Math.random(), drop: true });
    };
    floating().forEach(drop);
    // Only stones left: they drop too, and the board's clear.
    const left = cells();
    if (left.length && left.every(([i, c]) => get(i, c)!.kind === "stone")) left.forEach(drop);
    while (grid.length && !grid[grid.length - 1].some(Boolean)) grid.pop();

    const all = [...scored, ...dropped];
    const points =
      scored.length * POINTS.pop +
      dropped.length * POINTS.drop +
      all.filter((b) => b.kind === "prize").length * POINTS.prize +
      dropped.filter((b) => b.kind === "stone").length * POINTS.stone;
    if (all.length) {
      void playSound("pop");
      if (dropped.length) setTimeout(() => void playSound("pop"), 120);
      confetti({
        ...confettiStyle(),
        particleCount: 14 + all.length * 3,
        spread: 360,
        startVelocity: 14,
        ticks: 50,
        origin: { x: x / window.innerWidth, y: y / window.innerHeight },
      });
    }
    for (const b of all) if (b.kind === "pearl") award(POWERS[Math.floor(Math.random() * POWERS.length)]);
    opts.onTurn({ points, labels: all.flatMap((b) => (b.label !== undefined ? [b.label] : [])), x, y });

    if (!loaded.power && !colorsLeft().includes(loaded.look)) loaded = { look: randomLook() };
    if (!colorsLeft().includes(next.look)) next = { ...next, look: randomLook() };
    if (lowest() < 0) opts.onCleared();
    else if (lowest() >= maxRows) opts.onReachedBottom();
  };

  // Where a shot sticks: the nearest free spot that hangs off the top or
  // another bubble.
  const landing = (x: number, y: number): Cell | null => {
    let best: Cell | null = null;
    let bestD = Infinity;
    for (let i = 0; i <= grid.length; i++)
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
    return best;
  };

  const settle = (f: Flyer) => {
    const { shot } = f;
    if (shot.power === "bomb") {
      // 💣 blasts everything within two bubbles.
      const hit = cells().filter(([i, c]) => Math.hypot(at(i, c).x - f.x, at(i, c).y - f.y) < R * 4.3);
      void playSound("explode");
      confetti({ ...confettiStyle(), particleCount: 50, spread: 360, startVelocity: 22, ticks: 60, origin: { x: f.x / W, y: f.y / H } });
      return finishTurn(blow(hit, true), f.x, f.y);
    }
    const spot = landing(f.x, f.y);
    if (!spot) return finishTurn([], f.x, f.y);
    const [i, c] = spot;
    let look = shot.look;
    if (shot.power === "rainbow") {
      // 🌈 takes the color of the biggest group it's touching.
      let best = 0;
      for (const [a, b] of neighbours(i, c)) {
        const n = get(a, b);
        if (!n || !COLORED.has(n.kind) || n.chained) continue;
        const size = groupFrom(a, b, n.look).length;
        if (size > best) {
          best = size;
          look = n.look;
        }
      }
    }
    ensureRow(i);
    grid[i][c] = { look, kind: "normal" };
    const start: Cell[] = [];
    const group = groupFrom(i, c, look);
    if (group.length >= 3) {
      start.push(...group);
      for (const [a, b] of group) for (const n of neighbours(a, b)) if (NEXT_TO_POP.has(get(...n)?.kind ?? "normal")) start.push(n);
    }
    for (const n of neighbours(i, c)) {
      const b = get(...n);
      if (!b || !CONTACT.has(b.kind) || !solid(b)) continue;
      start.push(n);
      // ⭐ every bubble of this color goes.
      if (b.kind === "star") for (const cell of cells()) if (get(...cell)!.kind !== "rainbow" && matches(get(...cell), look)) start.push(cell);
    }
    finishTurn(start.length ? blow(start) : [], at(i, c).x, at(i, c).y);
  };

  const step = (dt: number) => {
    clock += dt;
    if (rowEvery > 0 && !paused && (rowClock += dt) >= rowEvery) {
      rowClock = 0;
      pushRow();
      if (lowest() >= maxRows) opts.onReachedBottom();
    }
    for (const f of [...flying]) {
      // Small steps so it can't tunnel through a bubble.
      const steps = Math.ceil((SPEED * dt) / (R * 0.4));
      for (let s = 0; s < steps && flying.includes(f); s++) {
        f.x += (f.vx * dt) / steps;
        f.y += (f.vy * dt) / steps;
        if (f.x < left + R) {
          f.x = left + R;
          f.vx = Math.abs(f.vx);
        } else if (f.x > right - R) {
          f.x = right - R;
          f.vx = -Math.abs(f.vx);
        }
        if (f.burned) {
          // 🔥 burns through everything it touches, out the top.
          for (const [i, c] of cells()) {
            if (f.burned.cells.has(key(i, c)) || Math.hypot(at(i, c).x - f.x, at(i, c).y - f.y) > R * 1.8) continue;
            f.burned.cells.add(key(i, c));
            f.burned.popped.push(...blow([[i, c]], true));
          }
          if (f.y < top - R) {
            flying.splice(flying.indexOf(f), 1);
            finishTurn(f.burned.popped, f.x, top + R);
          }
          continue;
        }
        let hit = f.y <= top + R;
        if (!hit)
          hit = cells().some(([i, c]) => solid(get(i, c)) && Math.hypot(at(i, c).x - f.x, at(i, c).y - f.y) < R * 1.7);
        if (hit) {
          flying.splice(flying.indexOf(f), 1);
          settle(f);
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
    for (let k = floats.length - 1; k >= 0; k--) if ((floats[k].t += dt) > floats[k].life) floats.splice(k, 1);
  };

  // ----- Drawing --------------------------------------------------------------

  const emoji = (text: string, x: number, y: number, size: number) => {
    ctx.font = `${Math.round(size)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color("primary"); // opaque: color emoji still take the fill's transparency
    ctx.fillText(text, x, y + size * 0.06);
  };
  // A pearl's rainbow sheen sweeping over it (as on the claw's pearls).
  const sheen = (x: number, y: number, s: number, seed: number) => {
    const r = s / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    const sweep = ((clock * 0.7 + seed * 0.013) % 1) * r * 5 - r * 2.5;
    const g = ctx.createLinearGradient(x + sweep - r, y - r, x + sweep + r, y + r);
    g.addColorStop(0, color("party-pink", 0));
    g.addColorStop(0.3, color("party-pink", 0.55));
    g.addColorStop(0.5, color("party-cyan", 0.6));
    g.addColorStop(0.7, color("party-yellow", 0.55));
    g.addColorStop(1, color("party-yellow", 0));
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, s, s);
    ctx.restore();
  };
  const fallback = ["party-red", "party-cyan", "party-yellow", "primary", "party-pink"];
  const drawOrb = (img: HTMLImageElement | HTMLCanvasElement | null, x: number, y: number, s: number, tint: number) => {
    if (img) ctx.drawImage(img, x - s / 2, y - s / 2, s, s);
    else {
      ctx.fillStyle = color(fallback[tint % fallback.length]);
      ctx.beginPath();
      ctx.arc(x, y, s / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  const drawBubble = (b: Bubble, x: number, y: number, scale = 1) => {
    const s = R * 2.05 * scale;
    const colored = COLORED.has(b.kind);
    ctx.save();
    if (b.kind === "ghost") ctx.globalAlpha *= ghostShown() ? 0.9 : 0.15 + 0.1 * Math.sin(clock * 9);
    if (b.kind === "pearl") {
      ctx.shadowColor = color("party-yellow", 0.9);
      ctx.shadowBlur = 10 + Math.sin(clock * 4 + x) * 5;
    }
    drawOrb(b.kind === "stone" ? stoneImg : colored ? looks[b.look] : pearl, x, y, s, b.look);
    ctx.shadowBlur = 0;
    if (b.kind === "pearl" || b.kind === "rainbow") sheen(x, y, s, x + y);
    if (b.iced) {
      // A frosty ice cube around it, with a glint.
      ctx.fillStyle = "rgba(255,255,255,0.32)";
      ctx.strokeStyle = color("party-cyan", 0.9);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(x - s * 0.5, y - s * 0.5, s, s, s * 0.24);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.32, y - s * 0.12);
      ctx.lineTo(x - s * 0.12, y - s * 0.32);
      ctx.stroke();
    }
    const icon = EMOJI[b.kind];
    if (icon && !(b.kind === "chained" && !b.chained)) {
      // Prize and chained are badges on a colored bubble; the rest fill a pearl.
      if (colored) emoji(icon, x + s * 0.22, y + s * 0.22, s * 0.42);
      else emoji(icon, x, y, s * 0.55);
    }
    ctx.restore();
    if (b.label !== undefined) drawLabel(ctx, `+${b.label}`, x, y, Math.round(R * 0.8));
  };
  const drawShot = (shot: Shot, x: number, y: number, scale = 1) => {
    const s = R * 2.05 * scale;
    if (shot.power && shot.power !== "triple") {
      drawOrb(shot.power === "fire" ? looks[0] : pearl, x, y, s, 0);
      if (shot.power === "rainbow") sheen(x, y, s, 0);
      emoji(POWER_INFO[shot.power].icon, x, y, s * 0.6);
      return;
    }
    drawOrb(looks[shot.look], x, y, s, shot.look);
    if (shot.power === "triple") emoji(POWER_INFO.triple.icon, x + s * 0.24, y + s * 0.24, s * 0.4);
  };

  // The dotted line, bounced off the walls, up to where it'd hit (only
  // part of the way in later rounds).
  const drawAim = (time: number) => {
    let x = shooter.x;
    let y = shooter.y;
    let vx = Math.cos(angle);
    let vy = Math.sin(angle);
    ctx.fillStyle = color("primary", 0.5);
    const gap = R * 0.7;
    const reach = aimFrac >= 1 ? Infinity : (shooter.y - top) * aimFrac;
    let travelled = 0;
    const offset = (time * R * 2) % gap; // the dots march outward
    const solidCells = cells().filter(([i, c]) => solid(get(i, c)));
    for (let d = offset, n = 0; n < 80; n++, d = gap) {
      x += vx * d;
      y += vy * d;
      travelled += d;
      if (travelled > reach) break;
      if (x < left + R) {
        x = 2 * (left + R) - x;
        vx = -vx;
      } else if (x > right - R) {
        x = 2 * (right - R) - x;
        vx = -vx;
      }
      if (y < top + R) break;
      if (solidCells.some(([i, c]) => Math.hypot(at(i, c).x - x, at(i, c).y - y) < R * 1.7)) break;
      ctx.globalAlpha = aimFrac >= 1 ? 1 : Math.max(0.15, 1 - travelled / reach);
      ctx.beginPath();
      ctx.arc(x, y, R * 0.13, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
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

    grid.forEach((row, i) => row.forEach((b, c) => b && drawBubble(b, at(i, c).x, at(i, c).y)));
    for (const e of fx) {
      if (e.drop) drawBubble(e.b, e.x, e.y);
      else {
        ctx.globalAlpha = 1 - e.t / 0.25;
        drawBubble(e.b, e.x, e.y, 1 + e.t * 2);
        ctx.globalAlpha = 1;
      }
    }

    if (!flying.length) drawAim(time);
    // The shooter: a ring with the loaded bubble and an arrow; the next one
    // (tap it to swap) beside it.
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
    drawShot(loaded, shooter.x, shooter.y);
    ctx.strokeStyle = color("primary", 0.35);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(nextAt.x, nextAt.y, R * 0.95, 0, Math.PI * 2);
    ctx.stroke();
    drawShot(next, nextAt.x, nextAt.y, 0.7);
    drawLabel(ctx, "swap", nextAt.x, nextAt.y - R * 1.35, 11);
    if (pending.length) drawLabel(ctx, `+${pending.length}`, nextAt.x - R * 1.3, nextAt.y + R * 0.6, 11);
    if (rowEvery > 0) {
      // Time until the next row comes down.
      const w = R * 3.2;
      const x0 = shooter.x + R * 2.2;
      const y0 = shooter.y + R * 0.25;
      ctx.fillStyle = color("primary", 0.15);
      ctx.beginPath();
      ctx.roundRect(x0, y0, w, R * 0.35, R * 0.18);
      ctx.fill();
      ctx.fillStyle = color(rowEvery - rowClock < 2 ? "party-red" : "primary", 0.75);
      ctx.beginPath();
      ctx.roundRect(x0, y0, w * Math.max(0.05, 1 - rowClock / rowEvery), R * 0.35, R * 0.18);
      ctx.fill();
      drawLabel(ctx, "next row", x0 + w / 2, y0 - R * 0.45, 11);
    }
    if (newRowEvery) {
      // How many more misses before a row pushes down.
      for (let k = 0; k < newRowEvery; k++) {
        ctx.fillStyle = k < missesLeft ? color("primary", 0.7) : color("primary", 0.15);
        ctx.beginPath();
        ctx.arc(shooter.x + R * 2.4 + k * R * 0.55, shooter.y + R * 0.4, R * 0.18, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const f of flying) {
      if (f.burned) {
        // A little flame trail.
        for (let k = 1; k <= 4; k++) {
          ctx.globalAlpha = 0.5 - k * 0.1;
          emoji("🔥", f.x - (f.vx / SPEED) * R * k * 0.9, f.y - (f.vy / SPEED) * R * k * 0.9, R * (1.4 - k * 0.2));
        }
        ctx.globalAlpha = 1;
      }
      drawShot(f.shot, f.x, f.y);
    }
    for (const f of floats) {
      ctx.globalAlpha = Math.max(0, 1 - f.t / f.life);
      drawLabel(ctx, f.text, f.x, f.y - f.t * 30, f.size);
      ctx.globalAlpha = 1;
    }
  };

  return {
    step,
    draw,
    aim,
    fire,
    swap,
    nearNext,
    shooter,
    float,
    pause: () => (paused = true),
    setRowEvery: (seconds: number) => (rowEvery = seconds),
    center: { x: (left + right) / 2, y: top + (dangerY - top) * 0.45 },
    // A round of Keep playing.
    // `clocked`: rows come on a timer (setRowEvery) instead of after misses.
    startRound: (round: number, clocked = false) => {
      const spec = roundSpec(round);
      colors = spec.colors;
      newRowEvery = clocked ? 0 : spec.misses;
      aimFrac = spec.aim;
      const others = spec.unlocked.filter((k) => k !== "pearl");
      const specials: SpecialKind[] = Array.from({ length: spec.pearls }, (): SpecialKind => "pearl");
      if (spec.introduces && spec.introduces !== "pearl") specials.push(spec.introduces);
      while (specials.length < spec.pearls + spec.specials && others.length)
        specials.push(others[Math.floor(Math.random() * others.length)]);
      const shape = round === 1 ? SHAPES[0] : SHAPES[1 + Math.floor(Math.random() * (SHAPES.length - 1))];
      build(shape, specials);
      return spec;
    },
    // The celebration: a small board with the points on "+N" bubbles near
    // the bottom (quick to reach), plus a pearl to show off.
    startCelebration: (chunks: number[]) => {
      colors = 3;
      newRowEvery = 0;
      aimFrac = 1;
      build(SHAPES[0].slice(0, 4), ["pearl"]);
      const spots: Bubble[] = [];
      for (let i = grid.length - 1; i >= 0 && spots.length < chunks.length * 3; i--)
        for (const b of grid[i]) if (b && b.kind === "normal") spots.push(b);
      spots.sort(() => Math.random() - 0.5);
      chunks.forEach((n, k) => spots[k] && (spots[k].label = n));
    },
    // Dev panel helpers.
    devAdd: (kind: SpecialKind) => {
      const spots = cells().filter(([i, c]) => get(i, c)!.kind === "normal");
      const spot = spots[Math.floor(Math.random() * spots.length)];
      if (!spot) return;
      const b = get(...spot)!;
      b.kind = kind;
      if (kind === "ice") b.iced = true;
      if (kind === "chained") b.chained = true;
    },
    devPower: (p: Power) => award(p),
  };
}

type Bubbles = Awaited<ReturnType<typeof createBubbles>>;

// Drag (or move the mouse) to aim; let go (or click) to fire. Tap the next
// bubble to swap. Arrow keys aim, ↑ fires and ↓ swaps.
function controls(game: Bubbles, onInput: () => void) {
  let keyAngle = -Math.PI / 2;
  let swapping = false;
  return gameInput({
    down: (x, y) => {
      onInput();
      swapping = game.nearNext(x, y);
      if (!swapping) game.aim(x, y);
    },
    move: (x, y) => {
      if (!swapping) game.aim(x, y);
    },
    up: (x, y) => {
      if (swapping) {
        swapping = false;
        if (game.nearNext(x, y)) game.swap();
        return;
      }
      game.aim(x, y);
      game.fire();
    },
    key: (dir) => {
      onInput();
      if (dir === "up") return void game.fire();
      if (dir === "down") return game.swap();
      keyAngle = Math.max(-Math.PI + 0.2, Math.min(-0.2, keyAngle + (dir === "left" ? -0.08 : 0.08)));
      game.aim(game.shooter.x + Math.cos(keyAngle) * 100, game.shooter.y + Math.sin(keyAngle) * 100);
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
  // Cleared, or stuck? A fresh board with the points still to find.
  const restart = () => {
    if (!revealed) game.startCelebration(chunks.slice(collected));
  };
  const game: Bubbles = await createBubbles(ctx, W, H, board, {
    onFire: () => hint.remove(),
    onTurn: (r) => {
      for (const n of r.labels) {
        collected++;
        game.float(`+${n}`, r.x, r.y);
      }
      if (collected >= chunks.length && !revealed) {
        revealed = true;
        opts.onReveal?.();
        setTimeout(() => void playSound("cheer"), 300);
        void fadeOutLayer(layer, 900).then(() => (faded = true));
      }
    },
    onCleared: restart,
    onReachedBottom: restart,
  });
  game.startCelebration(chunks);
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

// "Keep playing": one game that ends when the bubbles reach the line. Rows
// come down on a clock that keeps speeding up. Clear the board for a bonus
// (+10 × the level) and the next level's board (bubbleLevels.ts: new shape,
// more colors, new specials) — its rows start at half the speed the last
// one got to (never slower than the last one started), so it gets faster
// and faster. +1 a bubble popped, +2 a drop, prizes and stones extra.
const START_ROW_SECONDS = 8; // first board: a row every 8 s…
const DOUBLE_AFTER = 45; // …twice as fast after this many seconds…
const RAMP_PER_SECOND = 1 / (START_ROW_SECONDS * DOUBLE_AFTER); // (rows/s gained each second)
const NEXT_START_MIN = 1.25; // …and each board starts at least this much faster than the last
export function playBubblesGame(opts: GameOptions): () => void {
  const { layer, ctx, W, H, safe } = createCanvasGame("game");
  let score = 0;
  let round = 1;
  let over = false;
  let between = false; // the gap between boards
  let rate = 1 / START_ROW_SECONDS; // rows per second
  let startRate = rate; // what this board started at
  const explained = new Set<SpecialKind>();
  let stop = () => layer.remove();
  let hint: HTMLElement | null = hintBubble(layer, "Aim, let go to shoot!", safe.y + safe.h * 0.55);
  let game: Bubbles | null = null;

  const begin = (n: number) => {
    if (!game) return;
    round = n;
    between = false;
    const spec = game.startRound(round, true);
    game.setRowEvery(1 / rate);
    game.float(`Level ${round}`, game.center.x, game.center.y, 34, 1.6);
    const intro = spec.introduces;
    if (intro && !explained.has(intro)) {
      explained.add(intro);
      hint?.remove();
      const h = hintBubble(layer, SPECIAL_INFO[intro].hint, safe.y + safe.h * 0.62);
      hint = h;
      setTimeout(() => h.remove(), 4000);
    }
  };

  void createBubbles(ctx, W, H, safe, {
    onFire: () => hint?.remove(),
    onTurn: (r) => {
      if (!r.points) return;
      opts.onScore((score += r.points));
      game?.float(`+${r.points}`, r.x, r.y);
    },
    onCleared: () => {
      if (between || over) return;
      between = true;
      game?.setRowEvery(0);
      const bonus = 10 * round;
      opts.onScore((score += bonus));
      void playSound("fanfare");
      game?.float(`Cleared! +${bonus}`, game.center.x, game.center.y, 24, 1.4);
      // Next board: half the speed this one reached, but always quicker
      // than this one started.
      startRate = rate = Math.max(rate / 2, startRate * NEXT_START_MIN);
      setTimeout(() => !over && begin(round + 1), 1400);
    },
    onReachedBottom: () => {
      if (over) return;
      over = true;
      game?.pause();
      void playSound("boom");
      opts.onGameOver?.();
    },
  }).then((g) => {
    game = g;
    begin(1);
    controls(g, () => hint?.remove());
    // Local dev server only (compiled away in deployed builds): jump to a
    // round, add a special, get a power shot.
    const dev =
      process.env.NODE_ENV === "development" && devMode()
        ? devPanel(safe, [
            {
              label: "Level",
              buttons: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => ({
                icon: String(n),
                run: () => {
                  begin(n);
                  return `Level ${n}`;
                },
              })),
            },
            {
              label: "Add",
              buttons: UNLOCK_ORDER.map((k) => ({
                icon: SPECIAL_INFO[k].icon,
                title: k,
                run: () => {
                  g.devAdd(k);
                  return `Added a ${k}`;
                },
              })),
            },
            {
              label: "Shot",
              buttons: POWERS.map((p) => ({
                icon: POWER_INFO[p].icon,
                title: POWER_INFO[p].name,
                run: () => {
                  g.devPower(p);
                  return POWER_INFO[p].name;
                },
              })),
            },
          ])
        : null;
    runLoop(layer, (dt, time) => {
      // The rows keep coming faster.
      if (!between && !over) {
        rate += RAMP_PER_SECOND * dt;
        g.setRowEvery(1 / rate);
      }
      g.step(dt);
      g.draw(time);
    });
    const prev = stop;
    stop = () => {
      dev?.remove();
      prev();
    };
  });

  onStop(() => stop());
  return () => stop();
}
