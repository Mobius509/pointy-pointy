"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  isMuted,
  pickCelebration,
  playCelebration,
  prefersReducedMotion,
  setMuted,
  stopAllCelebrations,
  unlockAudio,
} from "./celebrations";

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
  nextUp,
  effectId,
  onClose,
}: {
  avatarSrc: string;
  total: number;
  items: CelebrationItem[];
  milestonesUnlocked: { name: string }[];
  // The next milestone (or the goal itself once past them all).
  nextUp?: { name: string; pointsToGo: number } | null;
  // Force a specific effect (gallery); random when omitted.
  effectId?: string;
  onClose: () => void;
}) {
  const [headline] = useState(() => pick(HEADLINES));
  const [button] = useState(() => pick(BUTTONS));
  // Chosen up front so we know whether to hide the points until the kid
  // has whacked / popped / spun / scratched.
  const [effect] = useState(() => pickCelebration(effectId));
  const [revealed, setRevealed] = useState(
    () => !effect.revealsPoints || prefersReducedMotion(),
  );
  const [shown, setShown] = useState(0);
  const [muted, setMutedState] = useState(false);
  useEffect(() => setMutedState(isMuted()), []);

  const toggleMute = () => {
    unlockAudio();
    setMuted(!muted);
    setMutedState(!muted);
  };
  const avatarRef = useRef<HTMLImageElement>(null);
  const circleRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Lock page scroll, close on Escape. Browsers (iPhone especially) block
  // sound until the first tap, so any tap on the screen unlocks it —
  // reveal effects start with a tap anyway (whack, pop, spin, scratch).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    unlockAudio(); // works right away if the kid already tapped this visit
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onTap = () => unlockAudio();
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onTap, { capture: true });
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onTap, { capture: true });
    };
  }, [onClose]);

  // Fire the effect once the avatar has landed. Reveal effects call back
  // when the kid finishes; a safety timer reveals anyway if one never does.
  useEffect(() => {
    const timer = setTimeout(() => {
      void playCelebration(
        {
          avatarSrc,
          origin: avatarRef.current,
          target: circleRef.current,
          points: total,
          onReveal: () => setRevealed(true),
        },
        effect.id,
      );
    }, 350);
    const safety = setTimeout(() => setRevealed(true), 20000);
    return () => {
      clearTimeout(timer);
      clearTimeout(safety);
    };
  }, [avatarSrc, effect.id, total]);

  // Count the points up once they're revealed.
  useEffect(() => {
    if (!revealed) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 900);
      setShown(Math.round(total * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [revealed, total]);

  useEffect(() => {
    if (revealed) buttonRef.current?.focus();
  }, [revealed]);

  // Closing the screen clears any effect still running (piñata, candy…).
  useEffect(() => () => stopAllCelebrations(), []);

  // What earned the points (plus any milestone unlocked), one at a time.
  const lines = [
    ...items.map((i) => `${i.isBonus ? "⭐ " : ""}${i.name} +${i.points}`),
    ...milestonesUnlocked.map((m) => `🏆 Unlocked: ${m.name}!`),
  ];
  // Hidden (but still taking up space, so the circle doesn't move under
  // the effect) until the points are revealed.
  const reveal = revealed ? "animate-celebrate-pop-in" : "invisible";

  // Portal to <body>: the kid/parent panels use backdrop-blur, which would
  // otherwise trap this "fixed" screen inside the panel.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${headline} ${total} points approved`}
      className="fixed inset-0 z-[60] bg-celebrate flex flex-col items-center px-6 pb-8 pt-6 overflow-y-auto"
    >
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? "Turn sound on" : "Turn sound off"}
        aria-pressed={muted}
        className="btn-secondary absolute right-4 top-4 size-11 !p-0 text-lg"
      >
        {muted ? "🔇" : "🔊"}
      </button>

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
          <div
            ref={circleRef}
            className="size-48 sm:size-52 rounded-full bg-white flex flex-col items-center justify-center shadow-sm"
          >
            {revealed ? (
              <>
                <span className="text-7xl font-black text-pp-primary tabular-nums leading-none">
                  {shown}
                </span>
                <span className="mt-1 text-sm font-semibold text-pp-muted">
                  {total === 1 ? "point" : "points"}
                </span>
              </>
            ) : (
              <span className="text-8xl font-black text-pp-line leading-none animate-celebrate-wiggle">
                ?
              </span>
            )}
          </div>
        </div>

        <h2
          className={`mt-10 text-5xl sm:text-6xl font-semibold text-pp-primary text-center leading-tight ${reveal}`}
        >
          {headline}
        </h2>

        {nextUp && nextUp.pointsToGo > 0 && (
          <p
            className={`mt-5 rounded-full bg-white px-5 py-2 font-semibold text-pp-primary-strong shadow-sm tabular-nums ${reveal}`}
          >
            🏆 Next up: {nextUp.name} · {nextUp.pointsToGo.toLocaleString()} to go
          </p>
        )}

        {lines.length > 0 && (
          <div className={`mt-4 h-6 ${reveal}`}>
            <CyclingLine lines={lines} />
          </div>
        )}
      </div>

      <button
        ref={buttonRef}
        type="button"
        onClick={onClose}
        className={`btn-primary btn-lg w-full max-w-xl rounded-2xl h-16 ${reveal}`}
      >
        {button}
      </button>
    </div>,
    document.body,
  );
}

// Shows one line at a time, fading to the next every couple of seconds.
function CyclingLine({ lines }: { lines: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (lines.length < 2) return;
    const id = setInterval(() => setI((n) => (n + 1) % lines.length), 1800);
    return () => clearInterval(id);
  }, [lines.length]);
  return (
    <p
      key={i}
      aria-live="polite"
      className="text-center text-sm font-semibold text-pp-muted animate-celebrate-fade-in"
    >
      {lines[i]}
    </p>
  );
}
