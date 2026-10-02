"use client";

import { useEffect, useRef, useState } from "react";
import { Ring } from "./KidRing";

// The goal card at the bottom of Stats: "86% Towards Get a dog" — and as the
// kid scrolls down to it, it opens up like an accordion into a big ring for
// the goal itself. Mirrors GoalOpenCard in the iOS StatsView.
const CLOSED = 84; // px tall when closed
const OPEN = 430; // …and fully open

export function GoalOpenCard({
  goalName,
  goalPct,
  progress,
  target,
}: {
  goalName: string;
  goalPct: number;
  progress: number;
  target: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(0); // 0 closed … 1 open
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const el = box.current;
      if (!el) return;
      // Opens as its top climbs from the bottom of the screen to 45% up.
      const vh = window.innerHeight;
      const top = el.getBoundingClientRect().top;
      setOpen(Math.max(0, Math.min(1, (vh * 0.95 - top) / (vh * 0.5))));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const eased = open * open * (3 - 2 * open); // smoothstep
  // The open height is kept free underneath from the start, so the page can
  // always scroll far enough for the card to open all the way.
  return (
    <div ref={box} style={{ height: OPEN }}>
    <div
      style={{ height: CLOSED + (OPEN - CLOSED) * eased }}
      className="relative overflow-hidden rounded-[28px] bg-kid-card-soft"
    >
      {/* Closed: the percentage and the goal's name, in a row. */}
      <div
        style={{ opacity: 1 - eased * 1.6 }}
        className="absolute inset-x-0 top-0 flex h-[84px] items-center justify-between gap-4 px-6"
        aria-hidden={eased > 0.6}
      >
        <span className="text-[34px] font-medium leading-none text-kid-text-strong">{goalPct}%</span>
        <span className="text-right text-[13px] font-medium text-kid-text-strong">Towards {goalName}</span>
      </div>
      {/* Open: the big goal. */}
      <div
        style={{ opacity: Math.max(0, eased * 1.4 - 0.4), transform: `scale(${0.85 + 0.15 * eased})` }}
        className="absolute inset-x-0 top-0 origin-top px-5 pt-7"
        aria-hidden={eased < 0.4}
      >
        <p className="mb-3 text-center text-[17px] font-medium text-kid-strong">The big goal: {goalName}</p>
        <Ring pct={goalPct} points={progress} label={`of ${target.toLocaleString()} points`} />
      </div>
    </div>
    </div>
  );
}
