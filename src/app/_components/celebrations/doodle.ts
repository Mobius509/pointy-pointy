import confetti from "canvas-confetti";
import { color, createCanvasGame, drawLabel, gameInput, loadImage, pointChunks, rand, runLoop, tinted, trimmed, type Area } from "./canvasGame";
import { confettiStyle, fadeOutLayer, hintBubble, onStop, type CelebrationOptions, type GameOptions } from "./shared";
import { playSound } from "./sounds";

// Doodle jump, with the kid's avatar: it stands on a platform, and each tap
// jumps it toward where you tapped. It lands on any platform it falls onto
// from above, and the screen scrolls up as you climb. Some platforms move,
// some crumble a moment after you land, and springs throw you high.
const PLATFORM_SRC = "/anims/platform.webp"; // the block stack's platform
const PLATFORM_ASPECT = 73 / 480;

const TUNE = {
  gravity: 2300, // px/s²
  reach: 2.3, // a jump goes this many platform gaps high
  spring: 1.7, // a spring throws you this much harder
  crumbleAfter: 1.1, // seconds a crumbly platform holds you
  moveSpeed: 0.12, // moving platforms, × court width per second (faster higher up)
  rampScreens: 4, // it gets harder over each this-many screens climbed:
  narrowest: 0.65, // platforms shrink to this share of their width…
  widest: 1.4, // …the gaps between them grow to this many times…
  hardAfter: 6, // …by this many steps up (then stay there)
};

type Kind = "plain" | "moving" | "crumbly" | "spring";
type Platform = {
  n: number; // counts up the tower
  x: number; // center
  w: number; // width (they get narrower the higher you go)
  y: number; // top, in world px (smaller = higher)
  kind: Kind;
  dir: number; // moving platforms: ±1
  crumble: number; // seconds left before it breaks (crumbly, once landed on); -1 = not started
  falling: number; // px it has fallen after breaking (0 = still whole)
  label?: number; // celebration: "+N" to collect by landing on it
};
type Art = {
  avatar: HTMLCanvasElement | HTMLImageElement | null;
  plain: HTMLImageElement | null;
  moving: HTMLCanvasElement | HTMLImageElement | null;
  crumbly: HTMLCanvasElement | HTMLImageElement | null;
};

async function loadArt(avatarSrc: string): Promise<Art> {
  const [avatar, plain] = await Promise.all([loadImage(avatarSrc), loadImage(PLATFORM_SRC)]);
  return {
    avatar: avatar && trimmed(avatar),
    plain,
    moving: plain && tinted(plain, "hue-rotate(180deg)"),
    crumbly: plain && tinted(plain, "grayscale(0.7) brightness(1.15)"),
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

// The shared machinery for the celebration and the game.
function createDoodle(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  court: Area,
  avatarSrc: string,
  events: {
    onLand: (p: Platform, screenX: number, screenY: number) => void;
    onFall: () => void; // dropped off the bottom
  },
  opts: { tricky: boolean; nextLabel?: () => number | undefined },
) {
  let art: Art = { avatar: null, plain: null, moving: null, crumbly: null };
  void loadArt(avatarSrc).then((a) => (art = a));
  const gap = Math.max(70, court.h / 7.5); // between platforms, on average
  const platW = Math.min(court.w * 0.26, 96);
  const platH = Math.max(12, platW * PLATFORM_ASPECT);
  const size = Math.min(64, gap * 0.75); // the avatar
  const jumpV = Math.sqrt(2 * TUNE.gravity * gap * TUNE.reach);
  const airTime = (2 * jumpV) / TUNE.gravity;

  let camY = 0; // world y at the top of the court
  const platforms: Platform[] = [];
  let count = 0;
  let topY = court.y + court.h - gap * 0.6; // the newest (highest) platform's y

  // How far up (0 at the start, 1 once it's as hard as it gets).
  const hardness = (y: number) =>
    opts.tricky ? Math.min(1, (court.y + court.h - y) / (court.h * TUNE.rampScreens * TUNE.hardAfter)) : 0;
  const kindFor = (y: number): Kind => {
    if (!opts.tricky) return Math.random() < 0.15 ? "moving" : "plain";
    const k = hardness(y);
    const r = Math.random();
    if (r < 0.07) return "spring";
    const moving = 0.04 + 0.24 * k;
    const crumbly = 0.02 + 0.24 * k;
    if (r < 0.07 + moving) return "moving";
    if (r < 0.07 + moving + crumbly) return "crumbly";
    return "plain";
  };
  const add = (y: number, kind: Kind, x?: number) => {
    const w = platW * (1 - (1 - TUNE.narrowest) * hardness(y));
    platforms.push({
      n: count++,
      x: x ?? rand(court.x + w / 2, court.x + court.w - w / 2),
      w,
      y,
      kind,
      dir: Math.random() < 0.5 ? -1 : 1,
      crumble: -1,
      falling: 0,
      label: opts.nextLabel?.(),
    });
  };

  // The first platform (under the avatar), then up and up as the camera rises.
  add(topY, "plain", court.x + court.w / 2);
  // Never a dead end: if a crumbly platform breaks, the next one up is
  // still in reach from the one below it.
  const reachable = gap * TUNE.reach * 0.9;
  let lastGap = 0;
  const fill = () => {
    while (topY > camY + court.y - court.h) {
      let next = gap * rand(0.8, 1.15) * (1 + (TUNE.widest - 1) * hardness(topY));
      if (platforms[platforms.length - 1]?.kind === "crumbly") next = Math.min(next, Math.max(gap * 0.6, reachable - lastGap));
      lastGap = next;
      topY -= next;
      add(topY, kindFor(topY));
    }
    // Drop the ones well below the screen.
    while (platforms.length && platforms[0].y > camY + court.y + court.h + gap * 2) platforms.shift();
  };
  fill();

  const me = { x: court.x + court.w / 2, y: platforms[0].y, vx: 0, vy: 0, on: platforms[0] as Platform | null, squash: 0, face: 1 };

  // How long a jump at speed `v` takes to come down onto something `rise`
  // px above where it started.
  const flight = (v: number, rise: number) => {
    const d = v * v - 2 * TUNE.gravity * Math.max(0, rise);
    return (v + Math.sqrt(Math.max(0, d))) / TUNE.gravity;
  };
  const maxVx = court.w / (airTime * 0.6);
  const aim = (dx: number, t: number) => Math.max(-maxVx, Math.min(maxVx, dx / t));

  // Tap: jump toward the tap, timed to come down where you tapped — tap a
  // platform to land on it (only from a platform; no double jumps).
  const jump = (tapX: number, tapY?: number) => {
    if (!me.on) return;
    const rise = tapY === undefined ? gap : Math.min(gap * TUNE.reach * 0.95, me.y - (tapY + camY));
    me.vy = -jumpV;
    me.vx = aim(tapX - me.x, flight(jumpV, rise));
    if (me.vx) me.face = Math.sign(me.vx);
    me.on = null;
    void playSound("flap");
  };

  const land = (p: Platform) => {
    me.y = p.y;
    me.vy = 0;
    me.vx = 0;
    me.squash = 1;
    if (p.kind === "spring") {
      // A big throw, aimed at a platform high up (so it never lands you
      // in thin air).
      const v = jumpV * TUNE.spring;
      const top = (v * v) / (2 * TUNE.gravity);
      const goal = platforms
        .filter((q) => !q.falling && q.kind !== "spring" && p.y - q.y > top * 0.5 && p.y - q.y < top * 0.92)
        .sort((a, b) => a.y - b.y)[0];
      me.vy = -v;
      me.vx = goal ? aim(goal.x - me.x, flight(v, p.y - goal.y)) : 0;
      if (me.vx) me.face = Math.sign(me.vx);
      void playSound("powerUp");
    } else {
      me.on = p;
      void playSound("thud");
      if (p.kind === "crumbly" && p.crumble < 0) p.crumble = TUNE.crumbleAfter;
    }
    events.onLand(p, me.x, me.y - camY);
  };

  // Back on a fresh platform near the bottom of the screen.
  const respawn = () => {
    const y = camY + court.y + court.h - gap * 0.8;
    const p: Platform = { n: -1, x: court.x + court.w / 2, w: platW, y, kind: "plain", dir: 1, crumble: -1, falling: 0 };
    platforms.unshift(p);
    me.x = p.x;
    me.y = y;
    me.vx = me.vy = 0;
    me.on = p;
  };

  const step = (dt: number) => {
    for (const p of platforms) {
      if (p.kind === "moving" && !p.falling) {
        const half = p.w / 2;
        const before = p.x;
        p.x += p.dir * TUNE.moveSpeed * (1 + hardness(p.y)) * court.w * dt;
        if (p.x < court.x + half || p.x > court.x + court.w - half) {
          p.dir = -p.dir;
          p.x = Math.max(court.x + half, Math.min(court.x + court.w - half, p.x));
        }
        if (me.on === p) me.x += p.x - before; // carried along
      }
      if (p.crumble > 0 && (p.crumble -= dt) <= 0) {
        p.falling = 1;
        void playSound("pop");
        if (me.on === p) me.on = null; // and down you go
      }
      if (p.falling) p.falling += 600 * dt;
    }
    if (!me.on) {
      const prevY = me.y;
      me.vy += TUNE.gravity * dt;
      me.x += me.vx * dt;
      me.y += me.vy * dt;
      // Bounce off the side walls.
      const half = size * 0.35;
      if (me.x < court.x + half) {
        me.x = court.x + half;
        me.vx = Math.abs(me.vx);
      } else if (me.x > court.x + court.w - half) {
        me.x = court.x + court.w - half;
        me.vx = -Math.abs(me.vx);
      }
      if (me.vy > 0) {
        // Landed: crossed a platform's top this frame, feet over it.
        const hit = platforms.find(
          (p) =>
            !p.falling &&
            prevY <= p.y &&
            me.y >= p.y &&
            Math.abs(me.x - p.x) <= p.w / 2 + size * (p.kind === "moving" ? 0.35 : 0.2),
        );
        if (hit) land(hit);
      }
    }
    me.squash = Math.max(0, me.squash - dt * 5);
    // The camera follows you up (never back down).
    camY = Math.min(camY, me.y - court.y - court.h * 0.6);
    fill();
    if (me.y - camY > court.y + court.h + size) {
      events.onFall();
      respawn();
    }
  };

  const drawPlatform = (p: Platform) => {
    const x = p.x;
    const y = p.y - camY + p.falling;
    const img = p.kind === "moving" ? art.moving : p.kind === "crumbly" ? art.crumbly : art.plain;
    ctx.save();
    if (p.falling) ctx.globalAlpha = Math.max(0, 1 - p.falling / 300);
    // A crumbly platform shakes once it starts to go.
    const shake = p.crumble > 0 ? Math.sin(p.crumble * 60) * 2 : 0;
    if (img) ctx.drawImage(img, x - p.w / 2 + shake, y, p.w, platH);
    else {
      ctx.fillStyle = color(p.kind === "moving" ? "party-cyan" : p.kind === "crumbly" ? "primary" : "accent", p.kind === "crumbly" ? 0.5 : 1);
      ctx.beginPath();
      ctx.roundRect(x - p.w / 2 + shake, y, p.w, platH, platH / 2);
      ctx.fill();
    }
    if (p.kind === "spring") {
      // A little coil on top.
      ctx.strokeStyle = color("party-red");
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) ctx.lineTo(x + (i % 2 ? 7 : -7), y - 2 - i * 3);
      ctx.stroke();
      ctx.fillStyle = color("party-red");
      ctx.beginPath();
      ctx.roundRect(x - 11, y - 24, 22, 5, 2.5);
      ctx.fill();
    }
    ctx.restore();
    if (p.label) drawLabel(ctx, `+${p.label}`, x, y - 18, 16);
  };

  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath();
    ctx.rect(court.x, court.y - size, court.w, court.h + size * 2);
    ctx.clip();
    for (const p of platforms) drawPlatform(p);
    // The avatar, feet on its platform (squashing a little as it lands,
    // stretching as it flies up), facing the way it's going.
    const stretch = me.on ? 1 - me.squash * 0.18 : 1 + Math.min(0.12, Math.max(-0.08, -me.vy / jumpV / 8));
    const h = size * stretch;
    const w = size * (2 - stretch);
    const x = me.x;
    const y = me.y - camY;
    if (art.avatar) {
      const aw = art.avatar.width;
      const ah = art.avatar.height;
      const k = Math.min(w / aw, h / ah);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(me.face < 0 ? -1 : 1, 1);
      ctx.drawImage(art.avatar, (-aw * k) / 2, -ah * k, aw * k, ah * k);
      ctx.restore();
    } else {
      ctx.fillStyle = color("accent");
      ctx.beginPath();
      ctx.arc(x, y - h / 2, h / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  const input = gameInput({
    down: (x, y) => jump(x, y),
    key: (dir) => {
      if (dir === "up") jump(me.x);
      if (dir === "left") jump(me.x - court.w * 0.3);
      if (dir === "right") jump(me.x + court.w * 0.3);
    },
  });

  return { step, draw, stop: input };
}

// Celebration: a few platforms carry "+N" — jump onto them to collect the
// points. Falling just puts you back on a platform. No crumbly ones.
export async function playDoodle(opts: CelebrationOptions): Promise<void> {
  const { layer, ctx, W, H, area } = createCanvasGame("celebration");
  const chunks = [...pointChunks(opts.points ?? 0)];
  const total = chunks.length;
  let collected = 0;
  let placed = 0;
  let revealed = false;
  let faded = false;
  const hint = hintBubble(layer, "Tap where you want to jump!", area.y + 16);
  const court = { x: area.x + 8, y: area.y + 70, w: area.w - 16, h: area.h - 100 };
  const doodle = createDoodle(
    ctx,
    W,
    H,
    court,
    opts.avatarSrc,
    {
      onLand: (p, x, y) => {
        if (!p.label) return;
        p.label = undefined;
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
      onFall: () => void playSound("whoops"),
    },
    {
      tricky: false,
      // Every other platform from the second on carries the next chunk.
      nextLabel: () => (placed++ % 2 === 1 && chunks.length ? chunks.shift() : undefined),
    },
  );
  const first = () => {
    hint.remove();
    window.removeEventListener("pointerdown", first);
  };
  window.addEventListener("pointerdown", first);

  await new Promise<void>((finish) => {
    runLoop(layer, (dt) => {
      doodle.step(dt);
      doodle.draw();
      if (faded) {
        finish();
        return false;
      }
    });
  });
  window.removeEventListener("pointerdown", first);
  doodle.stop();
  layer.remove();
}

// "Keep playing": +1 for every new platform you reach on the way up. Falling
// off the bottom costs one of three lives (and you're back on a platform).
// The higher you go, the more of them move, crumble or spring.
export function playDoodleGame(opts: GameOptions): () => void {
  const { layer, ctx, W, H, safe } = createCanvasGame("game");
  let score = 0;
  let best = 0; // the highest platform reached
  let lives = 3;
  opts.onLives?.(lives);
  let over = false;
  const hint = hintBubble(layer, "Tap where you want to jump!", safe.y + 16);
  const court = { x: safe.x + 4, y: safe.y + 8, w: safe.w - 8, h: safe.h - 16 };
  const doodle = createDoodle(
    ctx,
    W,
    H,
    court,
    opts.avatarSrc,
    {
      onLand: (p, x, y) => {
        if (over || p.n <= best) return;
        score += p.n - best;
        best = p.n;
        opts.onScore(score);
        if (p.n % 10 === 0) sparkle(x, y);
      },
      onFall: () => {
        if (over) return;
        lives -= 1;
        opts.onLives?.(lives);
        if (lives <= 0) {
          over = true;
          opts.onGameOver?.();
        } else void playSound("aww");
      },
    },
    { tricky: true },
  );
  const first = () => {
    hint.remove();
    window.removeEventListener("pointerdown", first);
  };
  window.addEventListener("pointerdown", first);
  const loop = runLoop(layer, (dt) => {
    if (!over) doodle.step(dt);
    doodle.draw();
    return !over;
  });

  const stop = () => {
    window.removeEventListener("pointerdown", first);
    loop();
    doodle.stop();
    layer.remove();
  };
  onStop(stop);
  return stop;
}
