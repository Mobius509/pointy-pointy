"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Ring } from "./KidRing";

// The goal module on Stats: two cards — the next milestone and the big
// goal. One is open (white, a big ring above its "N% Towards …" row) and the
// other is just its row. Scrolling down hands over from the milestone to the
// goal; tapping the closed one opens it. The two always add up to the same
// height, so nothing jumps. Mirrors GoalModule in the iOS StatsView.
//
// The hand-over only starts once the whole module is in view (above the tab
// bar), then runs over the next HANDOVER px of scrolling (or what's left of
// the page, if that's less). A page too short to scroll it is tap-only.
const RING_AREA = 310; // px above the row when a card is fully open
const ROW_OPEN = 85; // px: the "N% Towards …" row under an open ring
const ROW_CLOSED = 98; // px: a closed card
const HANDOVER = 260; // px of scrolling the hand-over takes
const TAB_BAR_ZONE = 135; // px at the bottom of the screen the tab bar covers
const GLIDE_MS = 140; // how quickly the cards catch up with the scroll (time constant)

type Card = { pct: number; caption: string; points: number; label: string; emoji: string | null };

export function GoalModule({ milestone, goal }: { milestone: Card; goal: Card }) {
  const card = useRef<HTMLElement>(null);
  const [p, setP] = useState(0); // 0: milestone open … 1: goal open
  const pRef = useRef(0);
  const manual = useRef<number | null>(null); // scrollY when a card was tapped
  const anim = useRef(0);

  const set = (v: number) => {
    pRef.current = v;
    setP(v);
  };
  // How far through the hand-over the scroll is (0–1), or null when the
  // page can't scroll far enough for one.
  const scrolledIn = useCallback(() => {
    const el = card.current;
    if (!el) return null;
    const bottom = el.getBoundingClientRect().bottom + window.scrollY; // on the page
    const start = Math.max(0, bottom - (window.innerHeight - TAB_BAR_ZONE)); // scrollY when it's all in view
    const room = Math.min(HANDOVER, document.documentElement.scrollHeight - window.innerHeight - start);
    if (room < 40) return null;
    return Math.max(0, Math.min(1, (window.scrollY - start) / room));
  }, []);

  // Scrolling sets where the hand-over should be; the cards ease there
  // (rather than jumping with every scroll step), so the rings draw on
  // smoothly.
  const target = useRef(0);
  const glide = useCallback(() => {
    cancelAnimationFrame(anim.current);
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      const from = pRef.current;
      const next = from + (target.current - from) * (1 - Math.exp(-dt / GLIDE_MS));
      set(Math.abs(target.current - next) < 0.001 ? target.current : next);
      if (pRef.current !== target.current) anim.current = requestAnimationFrame(step);
    };
    anim.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const s = scrolledIn();
      if (s === null) return;
      if (manual.current !== null) {
        if (Math.abs(window.scrollY - manual.current) < 40) return; // a tap's choice holds until they scroll on
        manual.current = null;
      }
      target.current = s;
      glide();
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
  }, [scrolledIn, glide]);

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
    <section ref={card} className="space-y-0.5 rounded-[36px] bg-kid-panel p-6">
      <Panel card={milestone} openness={1 - e} onOpen={() => open(0)} />
      <Panel card={goal} openness={e} onOpen={() => open(1)} />
    </section>
  );
}

function Panel({ card, openness, onOpen }: { card: Card; openness: number; onOpen: () => void }) {
  // The ring draws on (round from the bottom) as the card opens, rather
  // than growing.
  const d = Math.max(0, Math.min(1, (openness - 0.3) / 0.7));
  const draw = d * d * (3 - 2 * d);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-expanded={openness > 0.5}
      className="block w-full overflow-hidden rounded-[28px] text-left"
      style={{ backgroundColor: `color-mix(in srgb, white ${Math.round(openness * 100)}%, rgb(var(--kid-panel-soft)))` }}
    >
      <div style={{ height: RING_AREA * openness }} className="relative overflow-hidden">
        <div
          className="absolute left-1/2 top-[46px] -translate-x-1/2"
          style={{ width: 262, opacity: Math.max(0, Math.min(1, (openness - 0.12) * 2.2)) }}
        >
          <Ring pct={card.pct} points={card.points} label={card.label} emoji={card.emoji} draw={draw} />
        </div>
      </div>
      <div
        style={{ height: ROW_CLOSED + (ROW_OPEN - ROW_CLOSED) * openness }}
        className="flex items-center justify-between gap-4 px-[19px]"
      >
        <span className="text-[37px] font-medium leading-none text-kid-text-strong">{card.pct}%</span>
        <span className="text-right text-[14px] font-medium text-kid-text-strong">{card.caption}</span>
      </div>
    </button>
  );
}
