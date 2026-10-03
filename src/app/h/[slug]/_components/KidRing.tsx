"use client";

import { useEffect, useRef, useState } from "react";

// The kid app's goal ring (Stats page). Shared by the single goal card and
// the scroll-opening goal module; mirrors Ring in the iOS StatsView.
//
// A thick ring with rounded ends, starting at the bottom: the dark part is
// what they've earned, then a little gap, then the paler rest still to go.
// The pale part is always there; the dark part draws on into it, clockwise
// from the bottom, with the milestone's (or goal's) emoji riding its front —
// the first time it comes into view. `draw` (0–1) holds it part-drawn, for
// the goal module's hand-over.
export function Ring({
  pct,
  points,
  label,
  emoji = null,
  draw = 1,
}: {
  pct: number;
  points: number;
  label: string;
  emoji?: string | null;
  draw?: number;
}) {
  const intro = useDrawOn();
  const size = 280; // viewBox units; the ring scales to its box
  const stroke = 24;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = pct > 0 && pct < 100 ? stroke * 1.2 : 0; // room for the round ends
  const filled = Math.max(0, (c * pct) / 100 - gap / 2);
  const restEnd = c - gap; // where the pale part stops, short of the start
  // The pale part is always there; the dark part draws into it from the
  // bottom, the pale part's start pulling back ahead of it (keeping the gap).
  const shownFilled = filled * Math.max(0, Math.min(1, intro.value * draw));
  const lead = shownFilled + gap * Math.min(1, shownFilled / Math.max(1, gap)); // where the pale part starts
  const shownRest = Math.max(0, restEnd - lead);
  // The front of the dark part: clockwise from the bottom (in % of the box).
  const tip = Math.PI / 2 + (2 * Math.PI * shownFilled) / c;
  const at = (v: number) => `${((size / 2 + r * v) / size) * 100}%`;
  return (
    <div ref={intro.ref} className="relative mx-auto aspect-square w-full max-w-[280px]">
      <svg viewBox={`0 0 ${size} ${size}`} className="size-full rotate-90" aria-hidden>
        {shownRest > 0.5 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgb(var(--kid-track))"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${shownRest} ${c}`}
            strokeDashoffset={-lead}
          />
        )}
        {shownFilled > 0.5 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgb(var(--kid-strong))"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${shownFilled} ${c}`}
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-content-center px-8 text-center">
        <span className="text-[64px] font-medium leading-none text-kid-text tabular-nums">{points.toLocaleString()}</span>
        <span className="mt-1.5 text-[14px] font-medium text-kid-text">{label}</span>
      </div>
      {emoji && (
        <span
          aria-hidden
          className="absolute -translate-x-1/2 -translate-y-1/2 text-[38px] leading-none"
          style={{ left: at(Math.cos(tip)), top: at(Math.sin(tip)) }}
        >
          {emoji}
        </span>
      )}
    </div>
  );
}

const DRAW_MS = 1200;

// 0 → 1 over DRAW_MS (easing out) once the element is mostly on screen —
// straight to 1 for "reduce motion".
function useDrawOn() {
  const ref = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(1);
      return;
    }
    let raf = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / DRAW_MS);
          setValue(1 - (1 - t) ** 3);
          if (t < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);
  return { ref, value };
}
