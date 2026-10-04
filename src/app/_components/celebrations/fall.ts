import confetti from "canvas-confetti";
import { color, createCanvasGame, drawLabel, gameInput, loadImage, pointChunks, rand, runLoop, tinted, trimmed, type Area } from "./canvasGame";
import { confettiStyle, fadeOutLayer, hintBubble, onStop, type CelebrationOptions, type GameOptions } from "./shared";
import { playSound } from "./sounds";

// Free fall: the kid's avatar falls down an endless shaft of bars, each
// with one gap, sliding side to side. Hold to fall faster (and slide that
// finger to steer); let go and you slow to a cruise. Slip through the
// gaps — clip a bar at speed and it's a crash. Now and then the gaps of a
// few bars line up under a power orb: grab it to shoot straight down
// through all of them.
const BAR_SRC = "/anims/platform.webp"; // the block stack's platform, stretched into bars
const ORB_SRC = "/anims/orb-pearl.webp";
const BAR_ASPECT = 73 / 480;

const TUNE = {
  cruise: 0.2, // fall speed when not holding, × screen height per second…
  cruiseDeep: 0.42, // …creeping up to this, so deep down letting go isn't quite safe
  top: 0.85, // fastest while holding, × screen height per second…
  topDeep: 0.5, // …plus this much more once it's as hard as it gets
  speedUp: 2.2, // how quickly holding gets you to top speed
  slowDown: 2.4, // how quickly letting go gets you back to cruise
  crashAt: 0.3, // hitting a bar faster than this (× screen height/s) is a crash; slower, you just rest on it
  steer: 12, // how closely the avatar follows the finger
  spacing: 0.42, // between bars at the start, × screen height…
  spacingDeep: 0.3, // …and once it's hard
  gap: 3, // gap width at the start, × avatar size…
  gapDeep: 1.8, // …and once it's hard (never tighter)
  slide: 0.05, // how fast bars slide at the start, × court width per second…
  slideDeep: 0.25, // …and once it's hard
  align: 0.25, // chance a gap starts lined up with the one above
  hardAfter: 350, // bars until it's as hard as it gets
  orbFirst: 25, // the first power orb comes after this many bars…
  orbEvery: [20, 40], // …then every this many
  runLength: [4, 6], // bars in a lined-up run
  dash: 2.6, // power-orb speed, × screen height per second
};

type Row = {
  n: number;
  y: number; // top of the bar, world px (bigger = deeper)
  gapX: number; // center of the gap
  gapW: number;
  vx: number; // px/s; bounces off the sides
  passed: boolean;
  run: boolean; // part of a lined-up power-orb run (doesn't slide)
  label?: number; // celebration: "+N" for falling through it
  tint: number;
};
type Orb = { x: number; y: number; runEnd: number; taken: boolean };
type Art = {
  avatar: HTMLCanvasElement | HTMLImageElement | null;
  bars: (HTMLCanvasElement | HTMLImageElement)[];
  orb: HTMLImageElement | null;
};
const TINTS = ["none", "hue-rotate(180deg)", "hue-rotate(250deg)", "hue-rotate(320deg)"];

async function loadArt(avatarSrc: string): Promise<Art> {
  const [avatar, bar, orb] = await Promise.all([loadImage(avatarSrc), loadImage(BAR_SRC), loadImage(ORB_SRC)]);
  return { avatar: avatar && trimmed(avatar), bars: bar ? TINTS.map((t) => tinted(bar, t)) : [], orb };
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
function createFall(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  court: Area,
  avatarSrc: string,
  events: {
    onPass: (row: Row, screenX: number, screenY: number, dashing: boolean) => void;
    onCrash: () => void;
    onOrb: () => void;
  },
  opts: { easy: boolean; nextLabel?: () => number | undefined },
) {
  let art: Art = { avatar: null, bars: [], orb: null };
  void loadArt(avatarSrc).then((a) => (art = a));
  const size = Math.min(58, court.w * 0.15); // the avatar
  const r = size * 0.38; // its hit circle
  const barH = Math.max(14, Math.min(22, court.w * 0.05));
  const screenY = court.y + court.h * 0.28; // where the avatar sits on screen

  const me = { x: court.x + court.w / 2, y: 0, v: TUNE.cruise * H, target: court.x + court.w / 2, safe: 0, tilt: 0 };
  let holding = false;
  let dash: Orb | null = null;
  const rows: Row[] = [];
  const orbs: Orb[] = [];
  let count = 0;
  let nextY = H * 0.55; // world y of the next bar to make
  let nextOrb = TUNE.orbFirst;
  let runLeft = 0; // bars still to make in a lined-up run
  let runX = 0;

  const hardness = (n: number) => (opts.easy ? 0 : Math.min(1, n / TUNE.hardAfter));
  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

  const makeRow = () => {
    const k = hardness(count);
    const gapW = Math.max(size * TUNE.gapDeep, size * lerp(TUNE.gap, TUNE.gapDeep, k));
    const lo = court.x + gapW / 2;
    const hi = court.x + court.w - gapW / 2;
    const above = rows[rows.length - 1];
    let gapX = above && Math.random() < TUNE.align ? Math.max(lo, Math.min(hi, above.gapX)) : rand(lo, hi);
    let run = false;
    if (!opts.easy && runLeft === 0 && count >= nextOrb) {
      // Start a lined-up run with the power orb above it.
      runLeft = Math.round(rand(TUNE.runLength[0], TUNE.runLength[1] + 0.49));
      runX = rand(lo, hi);
      nextOrb = count + runLeft + Math.round(rand(TUNE.orbEvery[0], TUNE.orbEvery[1]));
      orbs.push({ x: runX, y: nextY - H * 0.12, runEnd: 0, taken: false });
    }
    if (runLeft > 0) {
      gapX = runX;
      run = true;
      runLeft--;
    }
    const speed = lerp(TUNE.slide, TUNE.slideDeep, k) * court.w * rand(0.6, 1.2);
    rows.push({
      n: count,
      y: nextY,
      gapX,
      gapW,
      vx: run ? 0 : speed * (Math.random() < 0.5 ? -1 : 1),
      passed: false,
      run,
      label: opts.nextLabel?.(),
      tint: run ? 0 : 1 + (count % 3),
    });
    if (run && runLeft === 0) orbs[orbs.length - 1].runEnd = nextY + barH;
    count++;
    nextY += H * lerp(TUNE.spacing, TUNE.spacingDeep, hardness(count)) * (run ? 0.6 : rand(0.85, 1.15));
  };
  const fill = () => {
    while (nextY < me.y + H * 1.2) makeRow();
    while (rows.length && rows[0].y < me.y - H) rows.shift();
    while (orbs.length && orbs[0].y < me.y - H && orbs[0].runEnd) orbs.shift();
  };
  fill();

  const step = (dt: number) => {
    // Speed: hold to fall faster (top speed creeps up as it gets harder).
    if (dash) {
      me.v = TUNE.dash * H;
      me.x += (dash.x - me.x) * Math.min(1, dt * 14);
    } else {
      const top = (TUNE.top + TUNE.topDeep * hardness(count - 4)) * H;
      const cruise = lerp(TUNE.cruise, TUNE.cruiseDeep, hardness(count - 4)) * H;
      const goal = holding ? top : cruise;
      me.v += (goal - me.v) * Math.min(1, dt * (holding ? TUNE.speedUp : TUNE.slowDown));
      const before = me.x;
      me.x += (me.target - me.x) * Math.min(1, dt * TUNE.steer);
      me.x = Math.max(court.x + r, Math.min(court.x + court.w - r, me.x));
      me.tilt += ((me.x - before) / Math.max(dt, 1e-3) / court.w - me.tilt) * Math.min(1, dt * 8);
    }
    me.safe = Math.max(0, me.safe - dt);
    const prevY = me.y;
    me.y += me.v * dt;

    for (const row of rows) {
      if (row.vx) {
        row.gapX += row.vx * dt;
        const lo = court.x + row.gapW / 2;
        const hi = court.x + court.w - row.gapW / 2;
        if (row.gapX < lo || row.gapX > hi) {
          row.vx = -row.vx;
          row.gapX = Math.max(lo, Math.min(hi, row.gapX));
        }
      }
      // Touching the bar's solid part?
      const inBand = me.y + r > row.y && me.y - r < row.y + barH;
      const inGap = Math.abs(me.x - row.gapX) <= row.gapW / 2 - r * 0.55;
      if (inBand && !inGap && !row.passed && !dash) {
        // Came down onto it: a crash if fast; slow, you just rest on top
        // until the gap comes round.
        if (prevY + r <= row.y + 2 || me.y < row.y + barH / 2) {
          const fast = me.v > TUNE.crashAt * H;
          me.y = row.y - r;
          me.v = 0;
          if (fast && me.safe <= 0) {
            me.safe = 1.1;
            void playSound("whoops");
            events.onCrash();
          }
        }
      }
      if (!row.passed && me.y - r > row.y + barH) {
        row.passed = true;
        events.onPass(row, me.x, screenY, !!dash);
      }
    }
    // The power orb: grab it to shoot down the lined-up run.
    for (const orb of orbs) {
      if (!orb.taken && Math.hypot(me.x - orb.x, me.y - orb.y) < r + size * 0.4) {
        orb.taken = true;
        dash = orb;
        void playSound("powerUp");
        events.onOrb();
      }
    }
    if (dash && dash.runEnd && me.y - r > dash.runEnd + 4) {
      dash = null;
      me.v = TUNE.top * H;
      me.safe = 0.4;
    }
    fill();
  };

  const toScreen = (y: number) => screenY + (y - me.y);

  const drawBar = (row: Row) => {
    const y = toScreen(row.y);
    if (y < court.y - barH * 2 || y > court.y + court.h + barH) return;
    const g1 = row.gapX - row.gapW / 2;
    const g2 = row.gapX + row.gapW / 2;
    const img = art.bars[row.tint % Math.max(1, art.bars.length)];
    for (const [a, b] of [
      [court.x, g1],
      [g2, court.x + court.w],
    ]) {
      const w = b - a;
      if (w < barH) continue;
      if (img) ctx.drawImage(img, a, y, w, barH);
      else {
        ctx.fillStyle = color(row.run ? "party-yellow" : "accent");
        ctx.beginPath();
        ctx.roundRect(a, y, w, barH, barH / 2);
        ctx.fill();
      }
    }
    if (row.label) drawLabel(ctx, `+${row.label}`, row.gapX, y + barH / 2, 16);
  };

  const draw = (time: number) => {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath();
    ctx.rect(court.x - 4, court.y, court.w + 8, court.h);
    ctx.clip();
    // Speed lines rushing up past the avatar, more the faster you fall.
    const lines = Math.round(Math.min(14, (me.v / H) * 9));
    ctx.strokeStyle = color("primary", 0.12);
    ctx.lineWidth = 2;
    for (let i = 0; i < lines; i++) {
      const x = court.x + ((i * 97.13 + 31) % court.w);
      const y = court.y + ((((i * 211.7 - me.y * 0.9) % court.h) + court.h) % court.h);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 18 + (me.v / H) * 40);
      ctx.stroke();
    }
    for (const row of rows) drawBar(row);
    for (const orb of orbs) {
      if (orb.taken) continue;
      const y = toScreen(orb.y) + Math.sin(time * 4) * 4;
      const s = size * 0.8;
      ctx.save();
      ctx.shadowColor = color("party-yellow", 0.9);
      ctx.shadowBlur = 14 + Math.sin(time * 6) * 6;
      if (art.orb) ctx.drawImage(art.orb, orb.x - s / 2, y - s / 2, s, s);
      else {
        ctx.fillStyle = color("party-yellow");
        ctx.beginPath();
        ctx.arc(orb.x, y, s / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    // The avatar: tilts as it steers, blinks just after a crash, glows on
    // a dash.
    if (!(me.safe > 0 && Math.floor(time * 12) % 2 === 0)) {
      ctx.save();
      ctx.translate(me.x, screenY);
      ctx.rotate(Math.max(-0.4, Math.min(0.4, me.tilt * 0.6)));
      if (dash) {
        ctx.shadowColor = color("party-yellow", 0.95);
        ctx.shadowBlur = 24;
      }
      if (art.avatar) {
        const aw = art.avatar.width;
        const ah = art.avatar.height;
        const k = size / Math.max(aw, ah);
        ctx.drawImage(art.avatar, (-aw * k) / 2, (-ah * k) / 2, aw * k, ah * k);
      } else {
        ctx.fillStyle = color("accent");
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  };

  // Hold to speed up and steer with the same finger; a mouse steers by
  // pointing (hold the button to speed up); arrows steer, down speeds up.
  let keyHold: ReturnType<typeof setTimeout> | undefined;
  const input = gameInput({
    down: (x) => {
      holding = true;
      me.target = x;
    },
    move: (x) => (me.target = x),
    up: () => (holding = false),
    key: (dir) => {
      if (dir === "left") me.target = Math.max(court.x, me.x - court.w * 0.22);
      if (dir === "right") me.target = Math.min(court.x + court.w, me.x + court.w * 0.22);
      if (dir === "down") {
        holding = true;
        clearTimeout(keyHold);
        keyHold = setTimeout(() => (holding = false), 350);
      }
    },
  });

  return {
    step,
    draw,
    stop: () => {
      clearTimeout(keyHold);
      input();
    },
  };
}

// Celebration: some gaps carry "+N" — fall through them to collect the
// points. Bumping a bar just stops you (no lives), and it stays easy.
export async function playFall(opts: CelebrationOptions): Promise<void> {
  const { layer, ctx, W, H, area } = createCanvasGame("celebration");
  const chunks = [...pointChunks(opts.points ?? 0)];
  const total = chunks.length;
  let collected = 0;
  let made = 0;
  let revealed = false;
  let faded = false;
  let started = false;
  const hint = hintBubble(layer, "Hold to fall faster — slide to steer!", area.y + area.h * 0.55);
  const court = { x: area.x + 8, y: area.y + 40, w: area.w - 16, h: area.h - 60 };
  const fall = createFall(
    ctx,
    W,
    H,
    court,
    opts.avatarSrc,
    {
      onPass: (row, x, y) => {
        if (!row.label) return;
        row.label = undefined;
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
      onCrash: () => {},
      onOrb: () => {},
    },
    { easy: true, nextLabel: () => (made++ % 2 === 1 && chunks.length ? chunks.shift() : undefined) },
  );
  const first = () => {
    started = true;
    hint.remove();
    window.removeEventListener("pointerdown", first);
  };
  window.addEventListener("pointerdown", first);

  await new Promise<void>((finish) => {
    runLoop(layer, (dt, t) => {
      if (started) fall.step(dt);
      fall.draw(t);
      if (faded) {
        finish();
        return false;
      }
    });
  });
  window.removeEventListener("pointerdown", first);
  fall.stop();
  layer.remove();
}

// "Keep playing": +1 for every gap you fall through (+2 for each one on a
// power-orb dash). A crash costs one of three lives. It gets faster, tighter
// and twistier the deeper you go.
export function playFallGame(opts: GameOptions): () => void {
  const { layer, ctx, W, H, safe } = createCanvasGame("game");
  let score = 0;
  let lives = 3;
  opts.onLives?.(lives);
  let over = false;
  let started = false;
  const hint = hintBubble(layer, "Hold to fall faster — slide to steer!", safe.y + safe.h * 0.55);
  const court = { x: safe.x + 4, y: safe.y + 4, w: safe.w - 8, h: safe.h - 8 };
  const fall = createFall(
    ctx,
    W,
    H,
    court,
    opts.avatarSrc,
    {
      onPass: (row, x, y, dashing) => {
        if (over) return;
        const before = score;
        score += dashing ? 2 : 1;
        opts.onScore(score);
        if (Math.floor(score / 10) > Math.floor(before / 10)) sparkle(x, y);
      },
      onCrash: () => {
        if (over) return;
        lives -= 1;
        opts.onLives?.(lives);
        if (lives <= 0) {
          over = true;
          opts.onGameOver?.();
        } else void playSound("aww");
      },
      onOrb: () => sparkle(W / 2, safe.y + safe.h * 0.28),
    },
    { easy: false },
  );
  const first = () => {
    started = true;
    hint.remove();
    window.removeEventListener("pointerdown", first);
  };
  window.addEventListener("pointerdown", first);
  const loop = runLoop(layer, (dt, t) => {
    if (started && !over) fall.step(dt);
    fall.draw(t);
    return !over;
  });

  const stop = () => {
    window.removeEventListener("pointerdown", first);
    loop();
    fall.stop();
    layer.remove();
  };
  onStop(stop);
  return stop;
}
