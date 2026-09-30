// Grab-and-throw emoji physics shared by <EmojiRain> (home page, kid
// view's "Make it rain") and the piñata celebration's candy burst.
//
// "rain": particles drift down from above and respawn at the top.
// "burst": particles fly out of one point, bounce on the floor, and pile
// up there; nothing respawns.
//
// Images are plain DOM <img>s moved with transforms each frame (no React
// re-renders). Pointer Events drive dragging so mouse + touch share a path.

export const EMOJI_SOURCES = [
  "/emojis/skateboard.png",
  "/emojis/dog1.png",
  "/emojis/shoes.png",
  "/emojis/gecko.png",
  "/emojis/bike.png",
  "/emojis/dog2.png",
  "/emojis/cat1.png",
  "/emojis/game.png",
  "/emojis/unicorn.png",
  "/emojis/cat2.png",
  "/emojis/fish.png",
  "/emojis/gift.png",
  "/emojis/money.png",
  "/emojis/shoes2.png",
  "/emojis/vacation.png",
];

// Pick a count + size RANGE based on viewport so the rain has visible
// scale variety. Mobile caps at 180px; desktop tops out at 250px.
export function rainCountAndSize(w: number): { count: number; sizeMin: number; sizeMax: number } {
  if (w >= 1280) return { count: 14, sizeMin: 160, sizeMax: 250 };
  if (w >= 1024) return { count: 12, sizeMin: 150, sizeMax: 220 };
  if (w >= 768) return { count: 10, sizeMin: 140, sizeMax: 200 };
  if (w >= 480) return { count: 8, sizeMin: 120, sizeMax: 180 };
  return { count: 6, sizeMin: 100, sizeMax: 180 };
}

const WALL_DAMP = 0.55;
const COLLISION_RESTITUTION = 0.55;
const VELOCITY_SAMPLE_WINDOW_MS = 80; // recent drag samples used for throw speed
const MAX_FLING = 40;

type Sample = { x: number; y: number; t: number };

type Particle = {
  el: HTMLImageElement;
  size: number;
  radius: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  rotSpeed: number;
  // Per-particle gravity multiplier: varied fall speeds make them bump.
  gravityMul: number;
  // While grabbed, physics is skipped but the particle still collides so
  // it can shove others around.
  dragging: boolean;
  dragOffsetX: number;
  dragOffsetY: number;
  samples: Sample[];
  // Where/when the current press started — to tell a tap from a throw.
  downX: number;
  downY: number;
  downT: number;
};

export type EmojiPhysicsOptions = {
  // Particles go behind (back) or in front of (front) the page content.
  back: HTMLElement;
  front: HTMLElement;
  sources: string[];
  count: number;
  sizeMin: number;
  sizeMax: number;
  backRatio: number;
  // Burst `floor` is the y (viewport px) the pile rests on; defaults to
  // the bottom of the screen.
  mode: { kind: "rain" } | { kind: "burst"; x: number; y: number; floor?: number };
  // Called for a quick tap (vs. a drag/throw). The particle has already
  // left the physics; the caller animates the element and removes it.
  onTap?: (el: HTMLImageElement) => void;
  // Oldest particles are removed past this many (endless piñata game).
  maxParticles?: number;
};

export type EmojiPhysics = {
  stop: () => void;
  // Burst mode: throw `count` more particles out of (x, y).
  burst: (x: number, y: number, count: number) => void;
};

// A quick tap (collect) vs. a drag (throw).
const TAP_MAX_MOVE_PX = 10;
const TAP_MAX_MS = 300;

const rand = (min: number, max: number) => min + Math.random() * (max - min);

export function startEmojiPhysics(opts: EmojiPhysicsOptions): EmojiPhysics {
  const { back, front, sources, count, sizeMin, sizeMax, backRatio, mode } = opts;
  const burst = mode.kind === "burst";
  // Rain drifts; a burst needs real gravity to arc and land.
  const GRAVITY = burst ? 0.45 : 0.009;
  const MAX_FALL_SPEED = burst ? 18 : 2.8;

  const W = () => window.innerWidth;
  const H = () => window.innerHeight;
  const particles: Particle[] = [];

  let spawned = 0;
  // Creates one particle: burst particles fly out of `at`, rain particles
  // start spread across (and above) the viewport so it doesn't start empty.
  function spawn(at?: { x: number; y: number }) {
    const size = Math.round(rand(sizeMin, sizeMax));
    // Collide as a circle a bit smaller than the bbox so transparent
    // padding around the artwork doesn't feel off.
    const radius = (size / 2) * 0.78;

    const el = document.createElement("img");
    el.src = sources[spawned++ % sources.length];
    el.alt = "";
    el.draggable = false;
    Object.assign(el.style, {
      position: "absolute",
      left: "0",
      top: "0",
      width: `${size}px`,
      height: `${size}px`,
      willChange: "transform",
      userSelect: "none",
      touchAction: "none",
      // Containers are pointer-events:none so empty space passes taps
      // through; particles opt back in so they're grabbable.
      pointerEvents: "auto",
      cursor: "grab",
    });
    (Math.random() < backRatio ? back : front).appendChild(el);

    const base = {
      el,
      size,
      radius,
      dragging: false,
      dragOffsetX: 0,
      dragOffsetY: 0,
      samples: [],
      downX: 0,
      downY: 0,
      downT: 0,
    };
    const p: Particle = at
      ? {
          ...base,
          x: at.x - size / 2 + rand(-20, 20),
          y: at.y - size / 2 + rand(-20, 20),
          vx: rand(-9, 9),
          vy: rand(-16, -6),
          rot: rand(0, 360),
          rotSpeed: rand(-8, 8),
          gravityMul: rand(0.8, 1.2),
        }
      : {
          ...base,
          x: rand(0, Math.max(0, W() - size)),
          y: rand(-H(), H() - size),
          vx: rand(-0.3, 0.3),
          vy: rand(0.05, 1.0),
          rot: rand(0, 360),
          rotSpeed: rand(-1.2, 1.2),
          gravityMul: rand(0.4, 1.6),
        };
    particles.push(p);
    attachDragHandlers(p);

    // Endless piles: drop the oldest resting pieces.
    while (opts.maxParticles && particles.length > opts.maxParticles) {
      const old = particles.shift()!;
      old.el.remove();
    }
  }

  const detach = (p: Particle) => {
    const i = particles.indexOf(p);
    if (i >= 0) particles.splice(i, 1);
  };

  for (let i = 0; i < count; i++) spawn(mode.kind === "burst" ? mode : undefined);

  // Pointer capture keeps move/up events on the particle even if the
  // pointer leaves it.
  function attachDragHandlers(p: Particle) {
    p.el.addEventListener("pointerdown", (e: PointerEvent) => {
      e.preventDefault();
      p.dragging = true;
      p.vx = 0;
      p.vy = 0;
      p.dragOffsetX = e.clientX - p.x;
      p.dragOffsetY = e.clientY - p.y;
      p.samples = [{ x: e.clientX, y: e.clientY, t: e.timeStamp }];
      p.downX = e.clientX;
      p.downY = e.clientY;
      p.downT = e.timeStamp;
      p.el.style.cursor = "grabbing";
      p.el.style.zIndex = "10";
      p.el.setPointerCapture(e.pointerId);
    });

    p.el.addEventListener("pointermove", (e: PointerEvent) => {
      if (!p.dragging) return;
      e.preventDefault();
      p.x = e.clientX - p.dragOffsetX;
      p.y = e.clientY - p.dragOffsetY;
      p.samples.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
      const cutoff = e.timeStamp - VELOCITY_SAMPLE_WINDOW_MS;
      while (p.samples.length > 0 && p.samples[0].t < cutoff) p.samples.shift();
    });

    const onRelease = (e: PointerEvent) => {
      if (!p.dragging) return;
      e.preventDefault();
      p.dragging = false;
      p.el.style.cursor = "grab";
      p.el.style.zIndex = "";
      try {
        p.el.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      // A quick tap in place collects it (when the caller wants taps).
      if (
        opts.onTap &&
        Math.hypot(e.clientX - p.downX, e.clientY - p.downY) < TAP_MAX_MOVE_PX &&
        e.timeStamp - p.downT < TAP_MAX_MS
      ) {
        detach(p);
        opts.onTap(p.el);
        return;
      }
      // Throw velocity from recent samples, in per-frame units (≈16.67ms).
      const s = p.samples;
      if (s.length >= 2) {
        const a = s[0];
        const b = s[s.length - 1];
        const ms = Math.max(1, b.t - a.t);
        const px = (b.x - a.x) / ms;
        const py = (b.y - a.y) / ms;
        p.vx = Math.max(-MAX_FLING, Math.min(MAX_FLING, px * 16.67));
        p.vy = Math.max(-MAX_FLING, Math.min(MAX_FLING, py * 16.67));
        p.rotSpeed = px * 0.4;
      }
      p.samples = [];
    };
    p.el.addEventListener("pointerup", onRelease);
    p.el.addEventListener("pointercancel", onRelease);
  }

  let raf = 0;
  let last = performance.now();
  let stopped = false;

  function step(now: number) {
    if (stopped) return;
    const dt = Math.min((now - last) / 16.6667, 3); // 1 unit ≈ one 60fps frame
    last = now;
    const w = W();
    const h = H();

    for (const p of particles) {
      if (p.dragging) continue;
      p.vy = Math.min(p.vy + GRAVITY * p.gravityMul * dt, MAX_FALL_SPEED * p.gravityMul);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.rotSpeed * dt;

      if (p.x < 0) {
        p.x = 0;
        p.vx = Math.abs(p.vx) * WALL_DAMP;
      }
      if (p.x > w - p.size) {
        p.x = w - p.size;
        p.vx = -Math.abs(p.vx) * WALL_DAMP;
      }
      // Burst candy lands on the floor and settles into a pile.
      const floor = mode.kind === "burst" ? (mode.floor ?? h) : h;
      if (burst && p.y > floor - p.size) {
        p.y = floor - p.size;
        p.vy = -Math.abs(p.vy) * 0.35;
        p.vx *= 0.85;
        p.rotSpeed *= 0.8;
        if (Math.abs(p.vy) < 0.6) p.vy = 0;
      }
    }

    // Pair-wise circle collisions: separate overlaps and exchange velocity
    // along the contact normal. A dragged particle pushes others but isn't
    // itself kicked.
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i];
        const b = particles[j];
        const dx = b.x + b.size / 2 - (a.x + a.size / 2);
        const dy = b.y + b.size / 2 - (a.y + a.size / 2);
        const dSq = dx * dx + dy * dy;
        const minDist = a.radius + b.radius;
        if (dSq >= minDist * minDist || dSq <= 0.001) continue;

        const dist = Math.sqrt(dSq);
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = minDist - dist;
        if (a.dragging && !b.dragging) {
          b.x += nx * overlap;
          b.y += ny * overlap;
        } else if (b.dragging && !a.dragging) {
          a.x -= nx * overlap;
          a.y -= ny * overlap;
        } else if (!a.dragging && !b.dragging) {
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;
        }

        const exchange = (a.vx * nx + a.vy * ny - (b.vx * nx + b.vy * ny)) * COLLISION_RESTITUTION;
        if (!a.dragging) {
          a.vx -= exchange * nx;
          a.vy -= exchange * ny;
        }
        if (!b.dragging) {
          b.vx += exchange * nx;
          b.vy += exchange * ny;
        }
        const kick = (a.rotSpeed - b.rotSpeed) * 0.05;
        if (!a.dragging) a.rotSpeed -= kick;
        if (!b.dragging) b.rotSpeed += kick;
      }
    }

    // Rain: respawn at the top once past the bottom, re-rolling speed.
    if (!burst) {
      for (const p of particles) {
        if (p.dragging || p.y <= h + p.size) continue;
        p.y = -p.size - rand(0, 200);
        p.x = rand(0, Math.max(0, W() - p.size));
        p.vx = rand(-0.3, 0.3);
        p.vy = rand(0.05, 0.8);
        p.rotSpeed = rand(-1.2, 1.2);
        p.gravityMul = rand(0.4, 1.6);
      }
    }

    for (const p of particles) {
      p.el.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.rot}deg)`;
    }
    raf = requestAnimationFrame(step);
  }

  raf = requestAnimationFrame(step);

  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      for (const p of particles) p.el.remove();
    },
    burst(x, y, n) {
      for (let i = 0; i < n; i++) spawn({ x, y });
    },
  };
}
