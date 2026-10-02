"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Ring } from "./KidRing";

// The bottom of Stats: two cards — the next milestone and the big goal. One
// is open (white, a big ring above its "N% Towards …" row) and the other is
// just its row. Scrolling down hands over from the milestone to the goal;
// tapping the closed one opens it. The two always add up to the same height,
// so nothing jumps. Mirrors GoalModule in the iOS StatsView.
const RING_AREA = 300; // px above the row when a card is fully open

type Card = { pct: number; caption: string; points: number; label: string };

export function GoalModule({ milestone, goal }: { milestone: Card; goal: Card }) {
  const box = useRef<HTMLElement>(null);
  const [p, setP] = useState(0); // 0: milestone open … 1: goal open
  const pRef = useRef(0);
  const manual = useRef<number | null>(null); // scrollY when a card was tapped
  const anim = useRef(0);

  const set = (v: number) => {
    pRef.current = v;
    setP(v);
  };
  // Where the scroll puts the hand-over: as the module's top climbs from
  // 75% of the screen to 35%.
  const fromScroll = useCallback(() => {
    const el = box.current;
    if (!el) return 0;
    const vh = window.innerHeight;
    return Math.max(0, Math.min(1, (vh * 0.75 - el.getBoundingClientRect().top) / (vh * 0.4)));
  }, []);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      if (manual.current !== null) {
        if (Math.abs(window.scrollY - manual.current) < 40) return; // a tap's choice holds until they scroll on
        manual.current = null;
      }
      cancelAnimationFrame(anim.current);
      set(fromScroll());
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
      cancelAnimationFrame(anim.current);
    };
  }, [fromScroll]);

  // Tap a card to open it (a quick ease, then it stays until they scroll).
  const open = (target: 0 | 1) => {
    manual.current = window.scrollY;
    cancelAnimationFrame(anim.current);
    const from = pRef.current;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 380);
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      set(from + (target - from) * e);
      if (t < 1) anim.current = requestAnimationFrame(step);
    };
    anim.current = requestAnimationFrame(step);
  };

  const e = p * p * (3 - 2 * p); // smoothstep
  return (
    <section ref={box} className="space-y-3.5 rounded-[36px] bg-kid-card p-[18px]">
      <Panel card={milestone} openness={1 - e} closedBg="var(--kid-card-inner)" onOpen={() => open(0)} />
      <Panel card={goal} openness={e} closedBg="var(--kid-card-soft)" onOpen={() => open(1)} />
    </section>
  );
}

function Panel({
  card,
  openness,
  closedBg,
  onOpen,
}: {
  card: Card;
  openness: number;
  closedBg: string;
  onOpen: () => void;
}) {
  const ring = 0.35 + 0.65 * openness; // ring size, as a share of full
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-expanded={openness > 0.5}
      className="block w-full overflow-hidden rounded-[28px] text-left"
      style={{ backgroundColor: `color-mix(in srgb, white ${Math.round(openness * 100)}%, rgb(${closedBg}))` }}
    >
      <div style={{ height: RING_AREA * openness }} className="relative overflow-hidden">
        <div
          className="absolute left-1/2 top-7 origin-top"
          style={{ width: 260, transform: `translateX(-50%) scale(${ring})`, opacity: Math.max(0, Math.min(1, (openness - 0.12) * 2.2)) }}
        >
          <Ring pct={card.pct} points={card.points} label={card.label} />
        </div>
      </div>
      <div className="flex h-[84px] items-center justify-between gap-4 px-6">
        <span className="text-[34px] font-medium leading-none text-kid-text-strong">{card.pct}%</span>
        <span className="text-right text-[13px] font-medium text-kid-text-strong">{card.caption}</span>
      </div>
    </button>
  );
}
