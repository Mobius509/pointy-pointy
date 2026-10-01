import confetti from "canvas-confetti";
import {
  color,
  createCanvasGame,
  drawLabel,
  gameInput,
  loadImage,
  trimmed,
  pointChunks,
  rand,
  runLoop,
  type Area,
} from "./canvasGame";
import { confettiStyle, hintBubble, onStop, type CelebrationOptions, type GameOptions } from "./shared";
import { playSound } from "./sounds";

// Artwork: a few moles, straight on or turned. Each time one pops up it's
// a random mole, and the turned ones are randomly mirrored so they face
// right or left.
const MOLES = [
  { src: "/anims/mole-front.webp", turned: false },
  { src: "/anims/mole-side.webp", turned: true },
  { src: "/anims/mole-blue.webp", turned: true },
];
const MOLE_ASPECT = 1.2; // height / width, for sizing (and the placeholder)
const HAMMER_SRC = "/anims/hammer.webp"; // upright, head at the top
const HAMMER_ASPECT = 304 / 200;

type Look = { art: number; flip: boolean };
type MoleArt = (HTMLImageElement | null)[];
const loadMoleArt = (): Promise<MoleArt> => Promise.all(MOLES.map((m) => loadImage(m.src)));
const randomLook = (): Look => {
  const art = Math.floor(Math.random() * MOLES.length);
  return { art, flip: MOLES[art].turned && Math.random() < 0.5 };
};

const AVATAR_PENALTY = 3; // points lost for bonking your own avatar
const COLS = 3;
const ROWS = 3;

type Hole = { x: number; y: number; w: number }; // center of the hole's opening
type Mole = {
  hole: number;
  pop: number; // 0 = hidden in the hole, 1 = all the way up
  rising: boolean;
  stay: number; // seconds left up top before it ducks back down
  look: Look;
  bonked: number; // > 0 while squashed and sinking
  label?: number;
  avatar?: boolean; // the kid's own avatar — don't bonk it!
};

function layoutHoles(area: Area): Hole[] {
  const cw = area.w / COLS;
  const ch = area.h / ROWS;
  const w = Math.min(cw * 0.8, ch * 0.75, 130);
  const holes: Hole[] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) holes.push({ x: area.x + cw * (c + 0.5), y: area.y + ch * (r + 0.78), w });
  return holes;
}

const moleSize = (h: Hole) => {
  const w = h.w * 0.85;
  return { w, h: w * MOLE_ASPECT };
};
// Top of the mole's head for how far it has popped up. All the way up is
// about two-thirds out, so its feet stay down in the hole.
const moleTop = (h: Hole, pop: number) => h.y - pop * moleSize(h).h * 0.66;

function drawHoleBack(ctx: CanvasRenderingContext2D, h: Hole) {
  ctx.fillStyle = color("primary", 0.12); // mound of dirt
  ctx.beginPath();
  ctx.ellipse(h.x, h.y + 4, h.w * 0.62, h.w * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color("primary-strong", 0.4); // the opening
  ctx.beginPath();
  ctx.ellipse(h.x, h.y, h.w / 2, h.w * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawHoleFront(ctx: CanvasRenderingContext2D, h: Hole) {
  ctx.strokeStyle = color("primary-strong", 0.25);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(h.x, h.y, h.w / 2, h.w * 0.16, 0, 0, Math.PI);
  ctx.stroke();
}

function drawMole(
  ctx: CanvasRenderingContext2D,
  art: MoleArt,
  h: Hole,
  m: Mole,
  time: number,
  avatar: HTMLImageElement | HTMLCanvasElement | null = null,
) {
  if (m.pop <= 0) return;
  const { w, h: mh } = moleSize(h);
  const top = moleTop(h, m.pop);
  ctx.save();
  // Underground is everything below the hole: the mask runs along the
  // front rim of the opening, so the mole comes up out of the round hole.
  const [rx, ry] = [h.w / 2, h.w * 0.16];
  ctx.beginPath();
  ctx.moveTo(h.x - h.w, top - 40);
  ctx.lineTo(h.x - h.w, h.y);
  ctx.lineTo(h.x - rx, h.y);
  ctx.ellipse(h.x, h.y, rx, ry, 0, Math.PI, 0, true); // left → front rim → right
  ctx.lineTo(h.x + h.w, h.y);
  ctx.lineTo(h.x + h.w, top - 40);
  ctx.closePath();
  ctx.clip();
  ctx.translate(h.x, top + mh / 2);
  if (m.bonked > 0) ctx.scale(1.15, 0.8); // squashed
  else ctx.rotate(Math.sin(time * 5 + h.x) * 0.04); // a little wiggle
  if (m.look.flip) ctx.scale(-1, 1);
  const img = m.avatar ? avatar : art[m.look.art];
  if (img) {
    // Keep each artwork's own proportions, standing on the same spot.
    const [nw, nh] = img instanceof HTMLImageElement ? [img.naturalWidth, img.naturalHeight] : [img.width, img.height];
    const ih = (w * nh) / nw;
    ctx.drawImage(img, -w / 2, mh / 2 - ih, w, ih);
  }
  else {
    ctx.fillStyle = color("muted");
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, mh / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (m.label && m.pop > 0.5 && m.bonked <= 0) drawLabel(ctx, `+${m.label}`, h.x, top - 14, 22);
}

// Moves a mole up, holds it, and sinks it. Returns false once it's gone.
function stepMole(m: Mole, dt: number): boolean {
  if (m.bonked > 0) {
    m.bonked -= dt;
    m.pop -= dt * 3;
    return m.pop > 0 || m.bonked > 0;
  }
  if (m.rising) {
    m.pop = Math.min(1, m.pop + dt * 7);
    if (m.pop >= 1) {
      m.stay -= dt;
      if (m.stay <= 0) m.rising = false;
    }
    return true;
  }
  m.pop -= dt * 4;
  return m.pop > 0;
}

// Is (x, y) on this mole? Generous, for little fingers.
function hit(h: Hole, m: Mole, x: number, y: number) {
  if (m.bonked > 0 || m.pop < 0.35) return false;
  const pad = 14;
  return Math.abs(x - h.x) < moleSize(h).w / 2 + pad && y > moleTop(h, m.pop) - pad && y < h.y + pad;
}

function bonk(h: Hole, m: Mole) {
  m.bonked = 0.35;
  void playSound("thud");
  void playSound("ow");
  if (navigator.vibrate) navigator.vibrate(20);
  confetti({
    ...confettiStyle(),
    particleCount: 16,
    spread: 360,
    startVelocity: 12,
    ticks: 50,
    origin: { x: h.x / window.innerWidth, y: moleTop(h, m.pop) / window.innerHeight },
  });
}

// The hammer: every tap swings it down onto the spot (like the piñata's
// bat). Pivots at the bottom of the handle; the head lands on the tap.
function hammer(size: number) {
  const img = { current: null as HTMLImageElement | null };
  void loadImage(HAMMER_SRC).then((i) => (img.current = i));
  const w = size;
  const h = size * HAMMER_ASPECT;
  const pivot = { x: 0.72 * w, y: 0.92 * h }; // in the artwork
  const head = { x: 0.42 * w - pivot.x, y: 0.13 * h - pivot.y }; // from the pivot
  const HIT = -0.35; // radians, leaning left as it lands
  const WIND = HIT + 1.1; // raised up to the right
  let swing: { x: number; y: number; t: number } | null = null;
  return {
    swing: (x: number, y: number) => (swing = { x, y, t: 0 }),
    draw(ctx: CanvasRenderingContext2D, dt: number) {
      if (!swing || !img.current) return;
      swing.t += dt;
      const { t } = swing;
      if (t > 0.6) return void (swing = null);
      // Swing down, hold for a beat, then lift away and fade.
      const down = Math.min(1, t / 0.18);
      const angle = t < 0.3 ? WIND + (HIT - WIND) * down * down : HIT + (t - 0.3) * 1.5;
      // Place the pivot so that at the hit angle the head is on the spot.
      const at = {
        x: swing.x - (head.x * Math.cos(HIT) - head.y * Math.sin(HIT)),
        y: swing.y - (head.x * Math.sin(HIT) + head.y * Math.cos(HIT)),
      };
      ctx.save();
      ctx.globalAlpha = t < 0.3 ? 1 : Math.max(0, 1 - (t - 0.3) / 0.3);
      ctx.translate(at.x, at.y);
      ctx.rotate(angle);
      ctx.drawImage(img.current, -pivot.x, -pivot.y, w, h);
      ctx.restore();
    },
  };
}

const freeHole = (holes: Hole[], moles: Mole[], avoid?: number) => {
  const free = holes.map((_, i) => i).filter((i) => i !== avoid && !moles.some((m) => m.hole === i));
  return free.length ? free[Math.floor(Math.random() * free.length)] : null;
};

// Celebration: moles pop up holding "+N". Bonk each one; the last bonk
// reveals the points. A mole that isn't bonked ducks and pops up somewhere
// else, until it's bonked.
export async function playMole(opts: CelebrationOptions): Promise<void> {
  const { layer, ctx, W, H, area } = createCanvasGame("celebration");
  const art = await loadMoleArt();
  const holes = layoutHoles({ x: area.x, y: area.y + area.h * 0.12, w: area.w, h: area.h * 0.72 });
  const queue = pointChunks(opts.points ?? 0);
  const moles: Mole[] = [];
  const hint = hintBubble(layer, "Bonk the moles!", area.y + 16);
  let revealed = false;
  let lastHole: number | undefined;
  const mallet = hammer(holes[0].w * 0.75);

  const popNext = () => {
    const hole = freeHole(holes, moles, lastHole);
    if (hole === null || !queue.length) return;
    lastHole = hole;
    moles.push({ hole, pop: 0, rising: true, stay: 2.2, look: randomLook(), bonked: 0, label: queue[0] });
  };

  const whack = (m: Mole) => {
    const h = holes[m.hole];
    mallet.swing(h.x, moleTop(h, m.pop) + 10);
    bonk(h, m);
    queue.shift();
    if (!queue.length && !revealed) {
      revealed = true;
      hint.remove();
      opts.onReveal?.();
      setTimeout(() => void playSound("cheer"), 150);
    }
  };

  gameInput({
    down: (x, y) => {
      hint.remove();
      const m = moles.find((m) => hit(holes[m.hole], m, x, y));
      if (m) whack(m);
      else mallet.swing(x, y); // a miss still gets a whack
    },
  });

  await new Promise<void>((finish) => {
    let doneIn = 1.2;
    runLoop(layer, (dt, time) => {
      for (let i = moles.length - 1; i >= 0; i--) {
        const m = moles[i];
        // Not bonked in time: duck down (it'll pop up somewhere else).
        if (!stepMole(m, dt)) moles.splice(i, 1);
      }
      if (!revealed && !moles.some((m) => m.bonked <= 0)) popNext();
      if (revealed && (doneIn -= dt) <= 0) {
        finish();
        return false;
      }
      ctx.clearRect(0, 0, W, H);
      holes.forEach((h, i) => {
        drawHoleBack(ctx, h);
        moles.filter((m) => m.hole === i).forEach((m) => drawMole(ctx, art, h, m, time));
        drawHoleFront(ctx, h);
      });
      mallet.draw(ctx, dt);
    });
  });
  layer.remove();
}

// "Keep playing": 30 seconds of moles popping up all over — bonk as many
// as you can (+1 each). Two at a time to start, up to four, quicker as time
// goes on. Sometimes the kid's own avatar pops up instead: bonk that and
// lose points.
export function playMoleGame(opts: GameOptions): () => void {
  const { layer, ctx, W, H, safe } = createCanvasGame("game");
  let art: MoleArt = [];
  void loadMoleArt().then((a) => (art = a));
  // Cropped to the character itself, so it sits in the hole like a mole.
  let avatar: HTMLImageElement | HTMLCanvasElement | null = null;
  void loadImage(opts.avatarSrc).then((i) => (avatar = i && trimmed(i)));
  const holes = layoutHoles(safe);
  // "-3" pop-ups after bonking the avatar.
  const oops: { x: number; y: number; t: number }[] = [];
  const moles: Mole[] = [];
  let score = 0;
  let spawnIn = 0.6;
  let elapsed = 0;
  const mallet = hammer(holes[0].w * 0.75);

  gameInput({
    down: (x, y) => {
      const m = moles.find((m) => hit(holes[m.hole], m, x, y));
      if (!m) return void mallet.swing(x, y);
      const h = holes[m.hole];
      mallet.swing(h.x, moleTop(h, m.pop) + 10);
      if (m.avatar) {
        // Oops — that was you!
        m.bonked = 0.35;
        void playSound("boom");
        if (navigator.vibrate) navigator.vibrate([40, 40, 40]);
        oops.push({ x: h.x, y: moleTop(h, m.pop), t: 0 });
        score = Math.max(0, score - AVATAR_PENALTY);
        opts.onScore(score);
        return;
      }
      bonk(h, m);
      opts.onScore(++score);
    },
  });

  runLoop(layer, (dt, time) => {
    elapsed += dt;
    spawnIn -= dt;
    const maxUp = elapsed < 8 ? 2 : elapsed < 18 ? 3 : 4;
    if (spawnIn <= 0 && moles.filter((m) => m.bonked <= 0).length < maxUp) {
      const hole = freeHole(holes, moles);
      if (hole !== null) {
        const stay = Math.max(0.55, 1.15 - elapsed * 0.02);
        const isAvatar = elapsed > 2 && Math.random() < 0.2;
        moles.push({ hole, pop: 0, rising: true, stay, look: randomLook(), bonked: 0, avatar: isAvatar });
      }
      spawnIn = Math.max(0.25, rand(0.4, 0.75) - elapsed * 0.012);
    }
    for (let i = moles.length - 1; i >= 0; i--) if (!stepMole(moles[i], dt)) moles.splice(i, 1);

    ctx.clearRect(0, 0, W, H);
    holes.forEach((h, i) => {
      drawHoleBack(ctx, h);
      moles.filter((m) => m.hole === i).forEach((m) => drawMole(ctx, art, h, m, time, avatar));
      drawHoleFront(ctx, h);
    });
    mallet.draw(ctx, dt);
    for (let i = oops.length - 1; i >= 0; i--) {
      const o = oops[i];
      o.t += dt;
      if (o.t > 0.9) {
        oops.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = 1 - o.t / 0.9;
      ctx.font = "900 30px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.lineWidth = 5;
      ctx.strokeStyle = "white";
      ctx.fillStyle = color("party-red");
      const y = o.y - 10 - o.t * 50;
      ctx.strokeText(`-${AVATAR_PENALTY}`, o.x, y);
      ctx.fillText(`-${AVATAR_PENALTY}`, o.x, y);
      ctx.restore();
    }
  });

  const stop = () => layer.remove();
  onStop(stop);
  return stop;
}
