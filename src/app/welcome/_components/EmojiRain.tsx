"use client";

import { useEffect, useRef } from "react";

const SOURCES = [
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

// Pick a count + size RANGE based on viewport. Each particle then picks
// a random size within the range so the rain has visible scale variety
// rather than uniform discs. Mobile caps at 180px; desktop tops out at
// 250px per the latest spec.
function pickCountAndSizeRange(
  w: number,
): { count: number; sizeMin: number; sizeMax: number } {
  if (w >= 1280) return { count: 14, sizeMin: 160, sizeMax: 250 };
  if (w >= 1024) return { count: 12, sizeMin: 150, sizeMax: 220 };
  if (w >= 768) return { count: 10, sizeMin: 140, sizeMax: 200 };
  if (w >= 480) return { count: 8, sizeMin: 120, sizeMax: 180 };
  return { count: 6, sizeMin: 100, sizeMax: 180 };
}

const GRAVITY = 0.009;
const MAX_FALL_SPEED = 2.8;
const WALL_DAMP = 0.55;
const COLLISION_RESTITUTION = 0.55;
// How many recent drag samples to keep for computing throw velocity.
const VELOCITY_SAMPLE_WINDOW_MS = 80;

type Sample = { x: number; y: number; t: number };

type Particle = {
  el: HTMLImageElement;
  // Pixel size of this particle (square) and its collision radius. Both
  // are per-particle now so the rain has visible scale variety.
  size: number;
  radius: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  rotSpeed: number;
  // Per-particle gravity multiplier. Lighter particles drift slowly while
  // heavier ones fall faster — varied terminal velocities means fast ones
  // catch up to slow ones and they bump.
  gravityMul: number;
  // Drag state. While a particle is being grabbed, physics integration is
  // skipped for it but it still participates in collisions so the user can
  // shove other particles around with it.
  dragging: boolean;
  // Cursor offset within the particle's bounding box at grab time.
  dragOffsetX: number;
  dragOffsetY: number;
  samples: Sample[];
};

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

// Renders two overlapping layers so particles can sit in front of OR
// behind whatever the page composes (e.g. a translucent white card).
// Place page content as `children` — it lands in the DOM between the
// two layers and just needs its own z-index between back (z-0) and
// front (z-20) for the depth illusion to read.
//
// Particles are randomly assigned to one of the two layers on creation
// so the scatter feels organic. Collisions still happen within each
// layer's set; we don't cross-layer collide (and it doesn't read as a
// problem visually).
export function EmojiRain({ children }: { children?: React.ReactNode }) {
  const backRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const back = backRef.current;
    const front = frontRef.current;
    if (!back || !front) return;

    const W = () => window.innerWidth;
    const H = () => window.innerHeight;

    const { count, sizeMin, sizeMax } = pickCountAndSizeRange(W());

    const particles: Particle[] = [];

    // Create img elements directly (avoids React re-renders per frame).
    for (let i = 0; i < count; i++) {
      const size = Math.round(rand(sizeMin, sizeMax));
      // Treat each emoji as a circle a bit smaller than its bbox so
      // transparent padding around the artwork doesn't make collisions
      // feel off.
      const radius = (size / 2) * 0.78;

      const el = document.createElement("img");
      el.src = SOURCES[i % SOURCES.length];
      el.alt = "";
      el.draggable = false;
      el.style.position = "absolute";
      el.style.left = "0";
      el.style.top = "0";
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.willChange = "transform";
      el.style.userSelect = "none";
      el.style.touchAction = "none";
      // Container has pointer-events:none so transparent space passes clicks
      // through to underlying buttons; individual particles opt in here so
      // they're grabbable.
      el.style.pointerEvents = "auto";
      el.style.cursor = "grab";
      // 40% of particles land behind the page content, 60% in front, so
      // the white card looks sandwiched in the depth stack.
      const target = Math.random() < 0.4 ? back : front;
      target.appendChild(el);

      const p: Particle = {
        el,
        size,
        radius,
        // Spread initial particles across (and above) the viewport so the
        // page doesn't start empty.
        x: rand(0, Math.max(0, W() - size)),
        y: rand(-H(), H() - size),
        vx: rand(-0.3, 0.3),
        vy: rand(0.05, 1.0),
        rot: rand(0, 360),
        rotSpeed: rand(-1.2, 1.2),
        gravityMul: rand(0.4, 1.6),
        dragging: false,
        dragOffsetX: 0,
        dragOffsetY: 0,
        samples: [],
      };
      particles.push(p);
      attachDragHandlers(p);
    }

    // ------------------------------------------------------------------------
    // Drag handling. Uses Pointer Events so mouse + touch flow through one
    // path. Pointer capture means the move/up events keep firing on the
    // particle even if the cursor leaves it.
    // ------------------------------------------------------------------------
    function attachDragHandlers(p: Particle) {
      p.el.addEventListener("pointerdown", (e: PointerEvent) => {
        e.preventDefault();
        p.dragging = true;
        p.vx = 0;
        p.vy = 0;
        // Where inside the particle did they grab? We move the particle so
        // the same pixel stays under the cursor as the mouse moves.
        p.dragOffsetX = e.clientX - p.x;
        p.dragOffsetY = e.clientY - p.y;
        p.samples = [{ x: e.clientX, y: e.clientY, t: e.timeStamp }];
        p.el.style.cursor = "grabbing";
        p.el.style.zIndex = "10";
        p.el.setPointerCapture(e.pointerId);
      });

      p.el.addEventListener("pointermove", (e: PointerEvent) => {
        if (!p.dragging) return;
        e.preventDefault();
        p.x = e.clientX - p.dragOffsetX;
        p.y = e.clientY - p.dragOffsetY;
        // Keep the most recent samples for velocity calc on release.
        p.samples.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
        const cutoff = e.timeStamp - VELOCITY_SAMPLE_WINDOW_MS;
        while (p.samples.length > 0 && p.samples[0].t < cutoff) {
          p.samples.shift();
        }
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
        // Compute throw velocity from the recent samples. Convert from
        // pixels-per-second-ish to per-frame (where 1 frame ≈ 16.67ms).
        const samples = p.samples;
        if (samples.length >= 2) {
          const a = samples[0];
          const b = samples[samples.length - 1];
          const ms = Math.max(1, b.t - a.t);
          const pxPerMs = {
            x: (b.x - a.x) / ms,
            y: (b.y - a.y) / ms,
          };
          // 16.67 ms per "frame" in our physics units.
          p.vx = pxPerMs.x * 16.67;
          p.vy = pxPerMs.y * 16.67;
          // Cap so a violent flick doesn't fling it light-years off-screen.
          const MAX_FLING = 40;
          p.vx = Math.max(-MAX_FLING, Math.min(MAX_FLING, p.vx));
          p.vy = Math.max(-MAX_FLING, Math.min(MAX_FLING, p.vy));
          // Spin a little when thrown horizontally.
          p.rotSpeed = pxPerMs.x * 0.4;
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
      // Frame-rate-independent step: 1 unit ≈ 60fps frame.
      const dt = Math.min((now - last) / 16.6667, 3);
      last = now;

      const w = W();
      const h = H();

      // Integrate motion (skip dragged particles — their position is set
      // directly by the pointer handler).
      for (const p of particles) {
        if (p.dragging) continue;

        p.vy = Math.min(
          p.vy + GRAVITY * p.gravityMul * dt,
          MAX_FALL_SPEED * p.gravityMul,
        );
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.rotSpeed * dt;

        // Side walls — bounce with damping.
        if (p.x < 0) {
          p.x = 0;
          p.vx = Math.abs(p.vx) * WALL_DAMP;
        }
        if (p.x > w - p.size) {
          p.x = w - p.size;
          p.vx = -Math.abs(p.vx) * WALL_DAMP;
        }
      }

      // Pair-wise circle collisions: separate overlapping pairs and
      // exchange velocity along the contact normal (subtle elastic). A
      // dragged particle still participates so users can shove others
      // around with it; we just don't give the dragged one a velocity kick.
      // minDist is now per-pair since each particle has its own radius.
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const ax = a.x + a.size / 2;
          const ay = a.y + a.size / 2;
          const bx = b.x + b.size / 2;
          const by = b.y + b.size / 2;
          const dx = bx - ax;
          const dy = by - ay;
          const dSq = dx * dx + dy * dy;
          const minDist = a.radius + b.radius;
          const minDistSq = minDist * minDist;
          if (dSq < minDistSq && dSq > 0.001) {
            const dist = Math.sqrt(dSq);
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = minDist - dist;

            // Position correction: push only non-dragged particles. If both
            // are dragged that's impossible (one pointer at a time) but we
            // guard anyway.
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

            // Velocity exchange — but a dragged particle's velocity is
            // controlled by the user; only kick the other one.
            const av = a.vx * nx + a.vy * ny;
            const bv = b.vx * nx + b.vy * ny;
            const exchange = (av - bv) * COLLISION_RESTITUTION;
            if (!a.dragging) {
              a.vx -= exchange * nx;
              a.vy -= exchange * ny;
            }
            if (!b.dragging) {
              b.vx += exchange * nx;
              b.vy += exchange * ny;
            }

            // Tiny rotational kick so collisions feel alive.
            const tangentialKick = (a.rotSpeed - b.rotSpeed) * 0.05;
            if (!a.dragging) a.rotSpeed -= tangentialKick;
            if (!b.dragging) b.rotSpeed += tangentialKick;
          }
        }
      }

      // Respawn at the top once a particle falls past the bottom. Re-roll
      // gravity multiplier so the speed mix keeps shuffling over time.
      // Size + radius are kept stable per particle for the life of the
      // session so the visual cast doesn't morph.
      for (const p of particles) {
        if (p.dragging) continue;
        if (p.y > h + p.size) {
          p.y = -p.size - rand(0, 200);
          p.x = rand(0, Math.max(0, W() - p.size));
          p.vx = rand(-0.3, 0.3);
          p.vy = rand(0.05, 0.8);
          p.rotSpeed = rand(-1.2, 1.2);
          p.gravityMul = rand(0.4, 1.6);
        }
      }

      // Write transforms.
      for (const p of particles) {
        p.el.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.rot}deg)`;
      }

      raf = requestAnimationFrame(step);
    }

    raf = requestAnimationFrame(step);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      for (const p of particles) p.el.remove();
    };
  }, []);

  return (
    <>
      <div
        aria-hidden
        ref={backRef}
        className="pointer-events-none absolute inset-0 overflow-hidden z-0"
      />
      {children}
      <div
        aria-hidden
        ref={frontRef}
        className="pointer-events-none absolute inset-0 overflow-hidden z-20"
      />
    </>
  );
}
