import confetti from "canvas-confetti";
import type MatterNS from "matter-js";
import { color, createCanvasGame, drawLabel, gameInput, loadImage, pointChunks, rand, runLoop, type Area } from "./canvasGame";
import { confettiStyle, fadeOutLayer, hintBubble, onStop, type CelebrationOptions, type GameOptions } from "./shared";
import { playSound } from "./sounds";
import { loadMatter } from "./stack";

// Coin drop (plinko): a dropper slides along the top — tap to let a coin
// go. It bounces down through the pegs (real physics) into a slot at the
// bottom: points, or a special. Golden pins (+1) and bumpers (+2) pay out
// as coins bounce off them. Specials: multi ball, rearrange the pins, a big
// coin (heavy — it sometimes snaps a pin clean off and keeps going), a
// magnet, a bonus coin, "two beside" (the scores of the slots either side),
// a skull, and a mystery. One bumper is the blue shift bumper: hitting it
// slides the prizes along a slot.
const COIN_SRC = "/anims/coin.webp";

const TUNE = {
  slots: 8,
  rows: 9,
  values: [10, 25, 50, 100, 100, 50, 25, 10], // left to right
  coins: 10, // in a game
  gravity: 0.0011,
  dropperSpeed: 0.35, // × board width per second…
  dropperSpeedUp: 0.04, // …faster by this much each coin (in the game)…
  dropperSpeedMax: 0.8,
  dropperCelebration: 0.25,
  bumpers: [2, 3], // how many, at random among the pegs (one of them the shift bumper)
  golden: [3, 4],
  bumperPoints: 2,
  goldenPoints: 1,
  specials: [1, 3], // slots holding a special at a time (in the game)
  shiftCooldown: 0.35, // seconds before the shift bumper can shift again
  multiBall: 3, // extra coins
  snapChance: 0.15, // a big coin hitting a pin snaps it off this often (it grows back once the coin lands)
  magnetPull: 0.00004, // force toward the best slot
};

type SpecialId = "multi" | "rearrange" | "big" | "magnet" | "bonus" | "beside" | "skull" | "mystery";
const SPECIALS: Record<SpecialId, { name: string; icon: string; weight: number; risky?: boolean }> = {
  multi: { name: "Multi ball!", icon: "🎱", weight: 3 },
  rearrange: { name: "Pins rearranged!", icon: "🔀", weight: 2 },
  big: { name: "Big coin next!", icon: "🪨", weight: 2 },
  magnet: { name: "Magnet next!", icon: "🧲", weight: 2 },
  bonus: { name: "+1 coin!", icon: "➕", weight: 3 },
  beside: { name: "Two beside!", icon: "↔️", weight: 3 },
  skull: { name: "Skull — lose a coin!", icon: "💀", weight: 2, risky: true },
  mystery: { name: "Mystery!", icon: "❓", weight: 2 },
};
const MYSTERY_POOL: SpecialId[] = ["multi", "rearrange", "big", "magnet", "bonus", "beside", "skull"];

type Peg = { body: MatterNS.Body; kind: "peg" | "gold" | "bumper" | "shifter"; flash: number };
type Coin = {
  body: MatterNS.Body;
  r: number;
  big: boolean;
  magnet: boolean;
  prevV: { x: number; y: number }; // its velocity before this frame (a big coin snapping a pin keeps it)
  stillFor: number; // seconds since it last got any further down (a stuck coin gets a nudge)
  lowest: number; // the furthest down it's been
  free: boolean; // a multi-ball extra (doesn't count against the round)
};
type Slot = { value: number; special?: SpecialId; label?: number };
type Mods = { big?: boolean; magnet?: boolean };

const pick = <T,>(list: [T, number][]): T => {
  const total = list.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of list) if ((r -= w) <= 0) return v;
  return list[list.length - 1][0];
};

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
async function createPlinko(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  board: Area,
  events: {
    onSlot: (slot: number, coin: Coin, x: number, y: number) => void;
    onBonus: (points: number, x: number, y: number) => void; // golden pin / bumper
    canDrop: () => boolean;
    onDrop: () => void;
  },
  opts: { celebration: boolean; dropperSpeed: () => number },
) {
  const M = await loadMatter();
  let coinImg: HTMLImageElement | null = null;
  void loadImage(COIN_SRC).then((i) => (coinImg = i));
  const engine = M.Engine.create({ gravity: { x: 0, y: 1, scale: TUNE.gravity } });

  const n = TUNE.slots;
  const slotW = board.w / n;
  const slotH = Math.max(46, board.h * 0.12);
  const floorY = board.y + board.h;
  const dropY = board.y + 26; // where coins start
  const pegTop = board.y + 78;
  const pegBottom = floorY - slotH - 22;
  const dx = slotW; // peg spacing across
  const dy = (pegBottom - pegTop) / (TUNE.rows - 1);
  const pegR = Math.max(4, dx * 0.08);
  const coinR = Math.max(9, dx * 0.27);
  const BIG = 1.35; // the big coin's size (still fits between two pins)

  const wall = (x: number, y: number, w: number, h: number, restitution = 0.2) =>
    M.Bodies.rectangle(x, y, w, h, { isStatic: true, friction: 0.05, restitution });
  M.Composite.add(engine.world, [
    wall(board.x + board.w / 2, floorY + 20, board.w + 200, 40), // floor
    wall(board.x - 20, board.y + board.h / 2, 40, board.h * 3, 0.5), // sides
    wall(board.x + board.w + 20, board.y + board.h / 2, 40, board.h * 3, 0.5),
    ...Array.from({ length: n - 1 }, (_, i) => wall(board.x + (i + 1) * slotW, floorY - slotH / 2, 4, slotH)), // slot dividers
  ]);

  // The pegs: staggered rows, plus a few bumpers and golden pins. Rearranging
  // shifts each row a random amount and deals new specials.
  let pegs: Peg[] = [];
  const pegById = new Map<number, Peg>();
  const snapped: Peg[] = []; // pins a big coin snapped off (back once it lands)
  const toSnap: { peg: Peg; coin: Coin }[] = [];
  const bits: { x: number; y: number; vx: number; vy: number; spin: number; t: number }[] = [];
  const layPegs = (shuffled: boolean) => {
    for (const p of pegs) M.Composite.remove(engine.world, p.body);
    snapped.length = 0;
    pegs = [];
    pegById.clear();
    const spots: { x: number; y: number }[] = [];
    for (let row = 0; row < TUNE.rows; row++) {
      const shift = shuffled ? rand(0, dx) : row % 2 ? dx / 2 : 0;
      const y = pegTop + row * dy + (shuffled ? rand(-dy * 0.12, dy * 0.12) : 0);
      // No peg so close to a wall that a coin could wedge between them.
      const margin = coinR * 2.4 + pegR;
      for (let x = board.x + shift; x <= board.x + board.w + 0.1; x += dx) {
        if (x < board.x + margin || x > board.x + board.w - margin) continue;
        spots.push({ x, y });
      }
    }
    const nBump = Math.round(rand(TUNE.bumpers[0], TUNE.bumpers[1] + 0.49));
    const nGold = Math.round(rand(TUNE.golden[0], TUNE.golden[1] + 0.49));
    const order = spots.map((_, i) => i).sort(() => Math.random() - 0.5);
    // Bumpers away from the top two rows and the edges.
    const bumpAt = new Set(
      order.filter((i) => spots[i].y > pegTop + dy * 1.5 && spots[i].x > board.x + dx * 0.8 && spots[i].x < board.x + board.w - dx * 0.8).slice(0, nBump),
    );
    const goldAt = new Set(order.filter((i) => !bumpAt.has(i)).slice(0, nGold));
    const shiftAt = [...bumpAt][0]; // one of the bumpers shifts the prizes
    spots.forEach((s, i) => {
      const kind: Peg["kind"] = i === shiftAt ? "shifter" : bumpAt.has(i) ? "bumper" : goldAt.has(i) ? "gold" : "peg";
      const big = kind === "bumper" || kind === "shifter";
      const body = M.Bodies.circle(s.x, s.y, big ? pegR * 2.4 : pegR, {
        isStatic: true,
        restitution: big ? 1.25 : 0.45,
        friction: 0.02,
      });
      const peg = { body, kind, flash: 0 };
      pegs.push(peg);
      pegById.set(body.id, peg);
    });
    M.Composite.add(
      engine.world,
      pegs.map((p) => p.body),
    );
  };
  layPegs(false);

  // Coins.
  const coins: Coin[] = [];
  const coinById = new Map<number, Coin>();
  const addCoin = (x: number, mods: Mods = {}, free = false) => {
    const r = coinR * (mods.big ? BIG : 1);
    const body = M.Bodies.circle(x, dropY, r, {
      restitution: mods.big ? 0.15 : 0.35,
      friction: 0.02,
      frictionAir: 0.008,
      density: mods.big ? 0.006 : 0.002,
    });
    M.Body.setVelocity(body, { x: rand(-0.3, 0.3), y: 0 });
    M.Composite.add(engine.world, body);
    const coin: Coin = {
      body,
      r,
      big: !!mods.big,
      magnet: !!mods.magnet,
      prevV: { x: 0, y: 0 },
      stillFor: 0,
      lowest: dropY,
      free,
    };
    coins.push(coin);
    coinById.set(body.id, coin);
    return coin;
  };
  const removeCoin = (c: Coin) => {
    M.Composite.remove(engine.world, c.body);
    coins.splice(coins.indexOf(c), 1);
    coinById.delete(c.body.id);
  };

  // The slots (the shift bumper slides their contents along one place).
  const slots: Slot[] = TUNE.values.map((value) => ({ value }));
  let slide = 0; // 0…1 while sliding
  let shiftReady = 0; // seconds until the shift bumper can shift again
  const shift = () => {
    slots.unshift(slots.pop()!);
    slide = 1;
    shiftReady = TUNE.shiftCooldown;
  };

  // Pins and bumpers pay out (and flash). A big coin sometimes snaps a
  // pin off: it tumbles away, the coin carries on through, and the pin
  // grows back once the coin has landed.

  let lastThud = 0;
  M.Events.on(engine, "collisionStart", (e: MatterNS.IEventCollision<MatterNS.Engine>) => {
    for (const pair of e.pairs) {
      const peg = pegById.get(pair.bodyA.id) ?? pegById.get(pair.bodyB.id);
      const coin = coinById.get(pair.bodyA.id) ?? coinById.get(pair.bodyB.id);
      if (!peg || !coin) continue;
      peg.flash = 1;
      if (peg.kind === "gold") events.onBonus(TUNE.goldenPoints, peg.body.position.x, peg.body.position.y);
      if (peg.kind === "bumper" || peg.kind === "shifter") {
        events.onBonus(TUNE.bumperPoints, peg.body.position.x, peg.body.position.y);
        void playSound("pop");
      }
      if (peg.kind === "shifter" && shiftReady <= 0) {
        shift();
        void playSound("clawMove");
      }
      if (coin.big && peg.kind === "peg" && Math.random() < TUNE.snapChance && !toSnap.some((t) => t.peg === peg))
        toSnap.push({ peg, coin });
      const now = performance.now();
      if (now - lastThud > 90) {
        lastThud = now;
        void playSound("thud");
      }
    }
  });

  // The dropper and the next coin's power-up.
  let dropX = board.x + board.w / 2;
  let dropDir = 1;
  const queued: Mods = {};
  const drop = () => {
    if (!events.canDrop()) return false;
    // One at a time: wait till the last one is well on its way.
    if (coins.some((c) => !c.free && c.body.position.y < pegTop + dy * 1.5)) return false;
    addCoin(dropX, { ...queued });
    queued.big = queued.magnet = false;
    events.onDrop();
    void playSound("flap");
    return true;
  };
  const input = gameInput({
    down: () => void drop(),
    key: (dir) => dir === "down" && void drop(),
  });
  const onSpace = (e: KeyboardEvent) => {
    if (e.key === " ") {
      e.preventDefault();
      void drop();
    }
  };
  window.addEventListener("keydown", onSpace);

  const bestSlotX = () => {
    let best = 0;
    slots.forEach((s, i) => (s.value > slots[best].value ? (best = i) : 0));
    return board.x + (best + 0.5) * slotW;
  };

  const step = (dt: number) => {
    const speed = opts.dropperSpeed() * board.w;
    dropX += dropDir * speed * dt;
    const lo = board.x + coinR * 1.2;
    const hi = board.x + board.w - coinR * 1.2;
    if (dropX < lo || dropX > hi) {
      dropDir = -dropDir;
      dropX = Math.max(lo, Math.min(hi, dropX));
    }
    shiftReady = Math.max(0, shiftReady - dt);
    slide = Math.max(0, slide - dt * 3);
    for (const p of pegs) p.flash = Math.max(0, p.flash - dt * 4);

    for (const c of coins) {
      c.prevV = { x: c.body.velocity.x, y: c.body.velocity.y };
      if (c.magnet) {
        const fx = (bestSlotX() - c.body.position.x) * TUNE.magnetPull * c.body.mass;
        M.Body.applyForce(c.body, c.body.position, { x: fx, y: 0 });
      }
      // A coin that hasn't got any further down for a moment (resting on a
      // pin, cradled or wedged) gets a nudge — toward the middle, and a bit
      // harder each time.
      const pos = c.body.position;
      if (pos.y > c.lowest + 3) {
        c.stillFor = 0;
        c.lowest = Math.max(c.lowest, pos.y);
      } else if ((c.stillFor += dt) > 0.9) {
        const toMiddle = Math.sign(board.x + board.w / 2 - pos.x) || 1;
        M.Body.setVelocity(c.body, { x: toMiddle * rand(1.5, 2.5), y: -1 });
        M.Body.setPosition(c.body, { x: pos.x + toMiddle * 2, y: pos.y - 2 });
        c.stillFor = 0.3;
      }
    }
    const ms = Math.min(dt, 1 / 20) * 1000;
    M.Engine.update(engine, ms / 2);
    M.Engine.update(engine, ms / 2);
    // Snap! The pin breaks off and the big coin goes on as if it wasn't there.
    for (const { peg, coin } of toSnap.splice(0)) {
      if (!pegs.includes(peg)) continue;
      M.Composite.remove(engine.world, peg.body);
      pegs.splice(pegs.indexOf(peg), 1);
      pegById.delete(peg.body.id);
      snapped.push(peg);
      M.Body.setVelocity(coin.body, { x: coin.prevV.x * 0.9, y: Math.max(coin.prevV.y, 1) * 0.9 });
      const { x, y } = peg.body.position;
      for (let i = 0; i < 2; i++) bits.push({ x, y, vx: rand(-60, 60), vy: rand(-80, -20), spin: rand(-12, 12), t: 0 });
      void playSound("explode");
    }
    for (const b of bits) {
      b.t += dt;
      b.vy += 900 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    while (bits.length && bits[0].t > 0.8) bits.shift();

    // Into a slot: pay out, and it's gone.
    for (const c of [...coins]) {
      const p = c.body.position;
      if (p.y > floorY - slotH * 0.55 || p.y > H + 50) {
        const slot = Math.max(0, Math.min(n - 1, Math.floor((p.x - board.x) / slotW)));
        removeCoin(c);
        // Snapped pins grow back once no big coin is still falling.
        if (snapped.length && !coins.some((o) => o.big)) {
          for (const peg of snapped.splice(0)) {
            peg.flash = 1;
            pegs.push(peg);
            pegById.set(peg.body.id, peg);
            M.Composite.add(engine.world, peg.body);
          }
        }
        events.onSlot(slot, c, board.x + (slot + 0.5) * slotW, floorY - slotH / 2);
      }
    }
  };

  const draw = (coinsLeft?: number) => {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = color("primary", 0.06);
    ctx.beginPath();
    ctx.roundRect(board.x - 6, board.y - 6, board.w + 12, board.h + 12, 20);
    ctx.fill();
    // Slots.
    for (let i = 0; i < n; i++) {
      const s = slots[i];
      const x = board.x + (i + 0.5) * slotW - slide * slotW;
      const y = floorY - slotH / 2;
      const special = s.special ? SPECIALS[s.special] : null;
      ctx.fillStyle = special ? color(special.risky ? "party-red" : "party-yellow", 0.22) : color("primary", i % 2 ? 0.08 : 0.04);
      ctx.fillRect(board.x + i * slotW + 2, floorY - slotH, slotW - 4, slotH);
      if (opts.celebration) {
        if (s.label) drawLabel(ctx, `+${s.label}`, x, y, 14);
      } else if (special) {
        ctx.font = `${Math.round(slotW * 0.42)}px system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#000";
        ctx.fillText(special.icon, x, y);
      } else drawLabel(ctx, String(s.value), x, y, Math.round(Math.min(15, slotW * 0.32)));
    }
    ctx.fillStyle = color("primary", 0.45);
    for (let i = 1; i < n; i++) ctx.fillRect(board.x + i * slotW - 2, floorY - slotH, 4, slotH);
    // Pegs.
    for (const p of pegs) {
      const { x, y } = p.body.position;
      const rr = p.body.circleRadius ?? pegR;
      ctx.save();
      if (p.kind === "gold") {
        ctx.shadowColor = color("party-yellow", 0.9);
        ctx.shadowBlur = 8 + p.flash * 12;
      }
      ctx.fillStyle =
        p.kind === "shifter"
          ? color("party-cyan")
          : p.kind === "bumper"
            ? color("party-pink")
            : p.kind === "gold"
              ? color("party-yellow")
              : color("primary", 0.55 + p.flash * 0.4);
      ctx.beginPath();
      ctx.arc(x, y, rr * (1 + p.flash * 0.25), 0, Math.PI * 2);
      ctx.fill();
      if (p.kind === "bumper") {
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(x, y, rr * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      if (p.kind === "shifter") {
        // Arrows: it slides the prizes along.
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        const a = rr * 0.5;
        ctx.beginPath();
        ctx.moveTo(x - a, y);
        ctx.lineTo(x + a, y);
        ctx.moveTo(x + a * 0.45, y - a * 0.5);
        ctx.lineTo(x + a, y);
        ctx.lineTo(x + a * 0.45, y + a * 0.5);
        ctx.stroke();
      }
      ctx.restore();
    }
    // Bits of snapped pins, tumbling away.
    for (const b of bits) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - b.t / 0.8);
      ctx.translate(b.x, b.y);
      ctx.rotate(b.spin * b.t);
      ctx.fillStyle = color("primary", 0.7);
      ctx.fillRect(-pegR, -pegR * 0.5, pegR * 2, pegR);
      ctx.restore();
    }
    // Coins.
    for (const c of coins) {
      const { x, y } = c.body.position;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(c.body.angle);
      if (c.magnet) {
        ctx.shadowColor = color("party-cyan", 0.9);
        ctx.shadowBlur = 14;
      }
      if (coinImg) ctx.drawImage(coinImg, -c.r * 1.1, -c.r * 1.1, c.r * 2.2, c.r * 2.2);
      else {
        ctx.fillStyle = color("party-yellow");
        ctx.beginPath();
        ctx.arc(0, 0, c.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    // The dropper: a coin waiting at the top, with the next coin's power-up.
    const ready = events.canDrop();
    ctx.globalAlpha = ready ? 1 : 0.35;
    ctx.fillStyle = color("primary", 0.7);
    ctx.beginPath();
    ctx.roundRect(dropX - coinR * 1.3, dropY - coinR * 1.6, coinR * 2.6, 6, 3);
    ctx.fill();
    const r = coinR * (queued.big ? BIG : 1);
    if (coinImg) ctx.drawImage(coinImg, dropX - r * 1.1, dropY - r * 1.1, r * 2.2, r * 2.2);
    ctx.globalAlpha = 1;
    const tag = queued.big ? "🪨" : queued.magnet ? "🧲" : "";
    if (tag) {
      ctx.font = "18px system-ui";
      ctx.textAlign = "center";
      ctx.fillStyle = "#000";
      ctx.fillText(tag, dropX + r * 1.6, dropY - r * 0.4);
    }
    // Coins left (the game), as dots along the top.
    if (coinsLeft !== undefined) {
      const shown = Math.min(coinsLeft, 16);
      const gap = 12;
      const x0 = board.x + board.w / 2 - ((shown - 1) * gap) / 2;
      ctx.fillStyle = color("party-yellow");
      for (let i = 0; i < shown; i++) {
        ctx.beginPath();
        ctx.arc(x0 + i * gap, board.y + 4, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  return {
    step,
    draw,
    slots,
    coins,
    queued,
    rearrange: () => layPegs(true),
    multiBall: (count: number) => {
      for (let i = 0; i < count; i++) addCoin(Math.max(board.x + coinR, Math.min(board.x + board.w - coinR, dropX + (i - (count - 1) / 2) * coinR * 2.4)), {}, true);
    },
    neighbours: (i: number) => (slots[i - 1]?.value ?? 0) + (slots[i + 1]?.value ?? 0),
    inPlay: () => coins.length,
    stop: () => {
      input();
      window.removeEventListener("keydown", onSpace);
      M.Events.off(engine, "collisionStart");
      M.Engine.clear(engine);
    },
  };
}

// Celebration: every slot shows the next "+N", so each coin collects the
// next bit of the points wherever it lands (five coins at most). No
// specials, and a slow dropper.
export async function playPlinko(opts: CelebrationOptions): Promise<void> {
  const { layer, ctx, W, H, area } = createCanvasGame("celebration");
  const chunks = [...pointChunks(opts.points ?? 0)];
  let revealed = false;
  let faded = false;
  const hint = hintBubble(layer, "Tap to drop a coin!", area.y + area.h * 0.45);
  const board = { x: area.x + 10, y: area.y + 40, w: area.w - 20, h: area.h - 70 };
  const plinko = await createPlinko(
    ctx,
    W,
    H,
    board,
    {
      onSlot: (_i, _coin, x, y) => {
        if (!chunks.length) return;
        chunks.shift();
        label();
        sparkle(x, y);
        void playSound("powerUp");
        if (!chunks.length && !revealed) {
          revealed = true;
          opts.onReveal?.();
          setTimeout(() => void playSound("cheer"), 150);
          void fadeOutLayer(layer, 600).then(() => (faded = true));
        }
      },
      onBonus: () => {},
      canDrop: () => !revealed,
      onDrop: () => hint.remove(),
    },
    { celebration: true, dropperSpeed: () => TUNE.dropperCelebration },
  );
  // Every slot shows the next chunk.
  function label() {
    for (const s of plinko.slots) s.label = chunks[0];
  }
  label();

  await new Promise<void>((finish) => {
    runLoop(layer, (dt) => {
      plinko.step(dt);
      plinko.draw();
      if (faded) {
        finish();
        return false;
      }
    });
  });
  plinko.stop();
  layer.remove();
}

// "Keep playing": ten coins (bonus coins add more; multi-ball extras are
// free). Score the slots they land in, plus golden pins and bumpers. The
// specials are re-dealt to new slots after every coin.
export function playPlinkoGame(opts: GameOptions): () => void {
  const { layer, ctx, W, H, safe } = createCanvasGame("game");
  let score = 0;
  let coinsLeft = TUNE.coins;
  let dropped = 0;
  let halveNext = false;
  let over = false;
  let stop = () => layer.remove();
  const hint = hintBubble(layer, "Tap to drop a coin!", safe.y + safe.h * 0.45);
  const board = { x: safe.x + 8, y: safe.y + 14, w: safe.w - 16, h: safe.h - 20 };
  let banner: { text: string; t: number } | null = null;
  const say = (text: string) => (banner = { text, t: 0 });
  const add = (points: number) => {
    if (over || points <= 0) return;
    score += points;
    opts.onScore(score);
  };

  void createPlinko(
    ctx,
    W,
    H,
    board,
    {
      onSlot: (i, coin, x, y) => {
        if (over) return;
        const s = plinko.slots[i];
        let special = s.special;
        if (special === "mystery") special = MYSTERY_POOL[Math.floor(Math.random() * MYSTERY_POOL.length)];
        if (!special) {
          let pts = s.value;
          if (halveNext) {
            pts = Math.ceil(pts / 2);
            halveNext = false;
          }
          add(pts);
          void playSound(pts >= 100 ? "powerUp" : "pop");
          if (pts >= 100) sparkle(x, y, 30);
        } else {
          say(`${s.special === "mystery" ? "❓ → " : ""}${SPECIALS[special].icon} ${SPECIALS[special].name}`);
          sparkle(x, y, 26);
          void playSound(special === "skull" ? "boom" : "powerUp");
          if (special === "multi") plinko.multiBall(TUNE.multiBall);
          if (special === "rearrange") plinko.rearrange();
          if (special === "big") plinko.queued.big = true;
          if (special === "magnet") plinko.queued.magnet = true;
          if (special === "bonus") coinsLeft++;
          if (special === "beside") add(plinko.neighbours(i));
          if (special === "skull") {
            if (coinsLeft > 0) coinsLeft--;
            else halveNext = true;
          }
        }
        if (!coin.free) deal();
        if (coinsLeft === 0 && plinko.inPlay() === 0 && !over) {
          over = true;
          setTimeout(() => opts.onGameOver?.(), 700);
        }
      },
      onBonus: (pts) => add(pts),
      canDrop: () => !over && coinsLeft > 0,
      onDrop: () => {
        hint.remove();
        coinsLeft--;
        dropped++;
      },
    },
    {
      celebration: false,
      dropperSpeed: () => Math.min(TUNE.dropperSpeedMax, TUNE.dropperSpeed + TUNE.dropperSpeedUp * dropped),
    },
  ).then((p) => {
    plinko = p;
    deal();
    const loop = runLoop(layer, (dt) => {
      p.step(dt);
      p.draw(coinsLeft);
      if (banner) {
        banner.t += dt;
        ctx.globalAlpha = Math.max(0, Math.min(1, (2 - banner.t) * 2));
        drawLabel(ctx, banner.text, W / 2, board.y + board.h * 0.42, 22);
        ctx.globalAlpha = 1;
        if (banner.t > 2) banner = null;
      }
      return true;
    });
    const prev = stop;
    stop = () => {
      loop();
      p.stop();
      prev();
    };
  });
  let plinko: Awaited<ReturnType<typeof createPlinko>>;

  // Specials on 1–3 slots, the rest back to points.
  function deal() {
    if (!plinko) return;
    for (const s of plinko.slots) s.special = undefined;
    const count = Math.round(rand(TUNE.specials[0], TUNE.specials[1] + 0.49));
    const order = plinko.slots.map((_, i) => i).sort(() => Math.random() - 0.5);
    const weights = (Object.keys(SPECIALS) as SpecialId[]).map((id) => [id, SPECIALS[id].weight] as [SpecialId, number]);
    for (let k = 0; k < count; k++) plinko.slots[order[k]].special = pick(weights);
  }

  onStop(() => stop());
  return () => stop();
}
