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
];

const COUNT = 14;
const SIZE = 150; // px, square
// Treat each emoji as a circle a bit smaller than its bbox so transparent
// padding around the artwork doesn't make collisions feel off.
const RADIUS = (SIZE / 2) * 0.78;
const GRAVITY = 0.022;
const MAX_FALL_SPEED = 4.2;
const WALL_DAMP = 0.55;
const COLLISION_RESTITUTION = 0.55;

type Particle = {
  el: HTMLImageElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  rotSpeed: number;
};

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function EmojiRain() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const W = () => window.innerWidth;
    const H = () => window.innerHeight;

    const particles: Particle[] = [];

    // Create img elements directly (avoids React re-renders per frame).
    for (let i = 0; i < COUNT; i++) {
      const el = document.createElement("img");
      el.src = SOURCES[i % SOURCES.length];
      el.alt = "";
      el.draggable = false;
      el.style.position = "absolute";
      el.style.left = "0";
      el.style.top = "0";
      el.style.width = `${SIZE}px`;
      el.style.height = `${SIZE}px`;
      el.style.willChange = "transform";
      el.style.userSelect = "none";
      container.appendChild(el);

      particles.push({
        el,
        // Spread initial particles across (and above) the viewport so the
        // page doesn't start empty.
        x: rand(0, Math.max(0, W() - SIZE)),
        y: rand(-H(), H() - SIZE),
        vx: rand(-0.4, 0.4),
        vy: rand(0.4, 1.6),
        rot: rand(0, 360),
        rotSpeed: rand(-1.5, 1.5),
      });
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

      // Integrate motion.
      for (const p of particles) {
        p.vy = Math.min(p.vy + GRAVITY * dt, MAX_FALL_SPEED);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.rotSpeed * dt;

        // Side walls — bounce with damping.
        if (p.x < 0) {
          p.x = 0;
          p.vx = Math.abs(p.vx) * WALL_DAMP;
        }
        if (p.x > w - SIZE) {
          p.x = w - SIZE;
          p.vx = -Math.abs(p.vx) * WALL_DAMP;
        }
      }

      // Pair-wise circle collisions: separate overlapping pairs and
      // exchange velocity along the contact normal (subtle elastic).
      const minDist = RADIUS * 2;
      const minDistSq = minDist * minDist;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const ax = a.x + SIZE / 2;
          const ay = a.y + SIZE / 2;
          const bx = b.x + SIZE / 2;
          const by = b.y + SIZE / 2;
          const dx = bx - ax;
          const dy = by - ay;
          const dSq = dx * dx + dy * dy;
          if (dSq < minDistSq && dSq > 0.001) {
            const dist = Math.sqrt(dSq);
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = minDist - dist;
            a.x -= nx * overlap * 0.5;
            a.y -= ny * overlap * 0.5;
            b.x += nx * overlap * 0.5;
            b.y += ny * overlap * 0.5;

            const av = a.vx * nx + a.vy * ny;
            const bv = b.vx * nx + b.vy * ny;
            const exchange = (av - bv) * COLLISION_RESTITUTION;
            a.vx -= exchange * nx;
            a.vy -= exchange * ny;
            b.vx += exchange * nx;
            b.vy += exchange * ny;

            // Tiny rotational kick so collisions feel alive.
            const tangentialKick = (a.rotSpeed - b.rotSpeed) * 0.05;
            a.rotSpeed -= tangentialKick;
            b.rotSpeed += tangentialKick;
          }
        }
      }

      // Respawn at the top once a particle falls past the bottom.
      for (const p of particles) {
        if (p.y > h + SIZE) {
          p.y = -SIZE - rand(0, 200);
          p.x = rand(0, Math.max(0, W() - SIZE));
          p.vx = rand(-0.4, 0.4);
          p.vy = rand(0.4, 1.2);
          p.rotSpeed = rand(-1.5, 1.5);
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
    <div
      aria-hidden
      ref={containerRef}
      className="pointer-events-none absolute inset-0 overflow-hidden z-[25]"
    />
  );
}
