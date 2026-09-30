"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { playCelebration } from "./celebrations";

// Full-screen "points approved" moment: avatar peeking over a white circle
// with the points, a random silly headline, and one of the celebration
// effects playing over the top. Used by the kid view (for real) and the
// parent gallery (as a preview).

const HEADLINES = [
  "What the what?!",
  "BOOM!",
  "Cha-ching!",
  "Ka-POW!",
  "Look at you go!",
  "Nailed it!",
  "Holy guacamole!",
  "Points o'clock!",
  "Unstoppable!",
  "Legendary!",
  "Whoa, nelly!",
  "Yahtzee!",
  "You're on fire!",
  "Big brain energy!",
  "Mic drop.",
  "Absolute legend!",
];

const BUTTONS = ["Heck yes!", "Woohoo!", "Let's go!", "I'm awesome", "Yay!", "Sweet!"];

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

export type CelebrationItem = {
  id: string;
  name: string;
  points: number;
  isBonus: boolean;
};

export function CelebrationScreen({
  avatarSrc,
  total,
  items,
  milestonesUnlocked,
  effectId,
  onClose,
}: {
  avatarSrc: string;
  total: number;
  items: CelebrationItem[];
  milestonesUnlocked: { name: string }[];
  // Force a specific effect (gallery); random when omitted.
  effectId?: string;
  onClose: () => void;
}) {
  const [headline] = useState(() => pick(HEADLINES));
  const [button] = useState(() => pick(BUTTONS));
  const [shown, setShown] = useState(0);
  const avatarRef = useRef<HTMLImageElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Lock page scroll, focus the button, close on Escape.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    buttonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Count the points up, and fire the effect once the avatar has landed.
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 900);
      setShown(Math.round(total * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const timer = setTimeout(() => {
      void playCelebration({ avatarSrc, origin: avatarRef.current }, effectId);
    }, 350);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [avatarSrc, effectId, total]);

  const extra = items.length - 4;

  // Portal to <body>: the kid/parent panels use backdrop-blur, which would
  // otherwise trap this "fixed" screen inside the panel.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${headline} ${total} points approved`}
      className="fixed inset-0 z-[60] bg-celebrate flex flex-col items-center px-6 pb-8 pt-6 overflow-y-auto"
    >
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-xl">
        {/* Avatar peeking over the points circle. */}
        <div className="relative mt-20">
          <div className="absolute left-1/2 -top-20 -translate-x-1/2">
            <img
              ref={avatarRef}
              src={avatarSrc}
              alt=""
              aria-hidden
              className="size-32 object-contain animate-celebrate-pop-in"
            />
          </div>
          <div className="size-48 sm:size-52 rounded-full bg-white flex flex-col items-center justify-center shadow-sm">
            <span className="text-7xl font-black text-pp-primary tabular-nums leading-none">
              {shown}
            </span>
            <span className="mt-1 text-sm font-semibold text-pp-muted">
              {total === 1 ? "point" : "points"}
            </span>
          </div>
        </div>

        <h2 className="mt-10 text-5xl sm:text-6xl font-semibold text-pp-primary text-center leading-tight">
          {headline}
        </h2>

        {milestonesUnlocked.map((m) => (
          <p
            key={m.name}
            className="mt-5 rounded-full bg-white px-5 py-2 font-semibold text-pp-primary-strong shadow-sm animate-celebrate-pop-in"
          >
            🏆 Unlocked: {m.name}!
          </p>
        ))}

        <ul className="mt-5 space-y-1 text-center text-sm text-pp-muted">
          {items.slice(0, 4).map((i) => (
            <li key={i.id}>
              {i.isBonus && "⭐ "}
              {i.name}{" "}
              <span className="font-semibold text-pp-primary">+{i.points}</span>
            </li>
          ))}
          {extra > 0 && <li>…and {extra} more</li>}
        </ul>
      </div>

      <button
        ref={buttonRef}
        type="button"
        onClick={onClose}
        className="btn-primary btn-lg w-full max-w-xl rounded-2xl h-16"
      >
        {button}
      </button>
    </div>,
    document.body,
  );
}
