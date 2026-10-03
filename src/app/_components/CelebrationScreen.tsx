"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  isMuted,
  pickCelebration,
  playCelebration,
  playSound,
  prefersReducedMotion,
  setMuted,
  startGame,
  stopAllCelebrations,
  tapToReplay,
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

export type HighScore = { score: number; initials: string };

export type CelebrationItem = {
  id: string;
  name: string;
  points: number;
  isBonus: boolean;
};

// How long "Keep playing" after a celebration lasts (an arcade ticket's
// time comes from the server — ARCADE_PLAY_MINUTES).
const KEEP_PLAYING_MINUTES = 5;
// The playtime countdown shows for the last this-many seconds (all of Keep
// playing's 5 minutes; just the end of an arcade ticket's day).
const SHOW_COUNTDOWN_SECONDS = 10 * 60;

export function CelebrationScreen({
  avatarSrc,
  total,
  items,
  milestonesUnlocked,
  nextUp,
  effectId,
  highScores,
  onSubmitHighScore,
  onClose,
  mode = "celebration",
  playUntil,
}: {
  avatarSrc: string;
  total: number;
  items: CelebrationItem[];
  milestonesUnlocked: { name: string }[];
  // The next milestone (or the goal itself once past them all).
  nextUp?: { name: string; pointsToGo: number } | null;
  // Force a specific effect (gallery); random when omitted.
  effectId?: string;
  // Family high scores by game id, e.g. { worm: { score: 42, initials: "FRE" } }.
  highScores?: Record<string, HighScore>;
  // Saves a finished round's score (kid view only — gallery previews don't
  // count). Resolves with the family best afterwards.
  onSubmitHighScore?: (game: string, score: number) => Promise<{ best: HighScore; isNew: boolean } | null>;
  onClose: () => void;
  // "game": open straight into the mini game (the kid's Arcade) — no
  // celebration, no points; Done closes it.
  mode?: "celebration" | "game";
  // When playing has to stop (ms since 1970) — an arcade ticket's day is
  // up. "Keep playing" after a celebration gets KEEP_PLAYING_MINUTES from
  // the first tap. Either way the game stops itself then: no "Play again".
  playUntil?: number;
}) {
  const gameOnly = mode === "game";
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
  const counterRef = useRef<HTMLDivElement>(null);

  // "Keep playing" mini game (piñata, balloons, and tap-to-replay ones).
  const [playing, setPlaying] = useState(gameOnly);
  const [score, setScore] = useState(0);
  // Score games are timed rounds; `round` bumps to start another.
  const [round, setRound] = useState(gameOnly ? 1 : 0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timesUp, setTimesUp] = useState(false);
  const [lives, setLives] = useState<number | null>(null);
  const [best, setBest] = useState<HighScore | null>(highScores?.[effect.id] ?? null);
  const [newBest, setNewBest] = useState(false);
  const scoreRef = useRef(0);
  const onScore = (n: number) => {
    scoreRef.current = n;
    setScore(n);
  };
  // Round over (time's up or game over): save it if it's a family best.
  const endRound = () => {
    stopGame.current();
    setTimesUp(true);
    void playSound("cheer");
    const final = scoreRef.current;
    if (!onSubmitHighScore || final <= 0) return;
    void onSubmitHighScore(effect.id, final).then((res) => {
      if (!res) return;
      setBest(res.best);
      setNewBest(res.isNew);
      if (res.isNew) void playSound("yay"); // on top of the end-of-round sound
    });
  };
  const stopGame = useRef<() => void>(() => {});
  const [deadline, setDeadline] = useState<number | null>(playUntil ?? null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const outOfTime = secondsLeft !== null && secondsLeft <= 0;
  const keepPlaying = () => {
    unlockAudio();
    setDeadline((d) => d ?? Date.now() + KEEP_PLAYING_MINUTES * 60_000);
    setPlaying(true);
    setRound((n) => n + 1);
  };
  // Playtime's limit: tick down, and when it's up end the round (the score
  // still counts) and don't offer another.
  const timesUpRef = useRef(false);
  timesUpRef.current = timesUp;
  useEffect(() => {
    if (!playing || deadline === null) return;
    const tick = () => {
      const left = Math.ceil((deadline - Date.now()) / 1000);
      setSecondsLeft(left);
      if (left <= 0) {
        clearInterval(timer);
        if (!timesUpRef.current) endRound();
      }
    };
    const timer = setInterval(tick, 1000);
    tick();
    return () => clearInterval(timer);
    // endRound only touches refs and state setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, deadline]);
  // Start once the counter is on screen, so collected candy knows where to fly.
  useEffect(() => {
    if (!playing) return;
    if (deadline !== null && deadline <= Date.now()) {
      setTimesUp(true); // out of time before it even started
      return;
    }
    onScore(0);
    setTimesUp(false);
    setNewBest(false);
    setLives(null);
    const r = counterRef.current?.getBoundingClientRect();
    stopGame.current = startGame(effect, {
      avatarSrc,
      counter: r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : undefined,
      onScore,
      onLives: setLives,
      // Arcade games end themselves (bit your tail, out of lives).
      onGameOver: endRound,
    });

    // Countdown for timed games; at zero the game stops and results show.
    const game = effect.game;
    let tick: ReturnType<typeof setInterval> | undefined;
    if (game?.kind === "score" && game.seconds) {
      let left = game.seconds;
      setTimeLeft(left);
      tick = setInterval(() => {
        left -= 1;
        setTimeLeft(left);
        if (left <= 0) {
          clearInterval(tick);
          endRound();
        }
      }, 1000);
    }
    return () => {
      clearInterval(tick);
      stopGame.current();
    };
    // endRound/onScore only touch refs and state setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, round, effect, avatarSrc]);

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
  // when the kid finishes the mini game — no timeout, they have to play.
  useEffect(() => {
    if (gameOnly) return;
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
    return () => clearTimeout(timer);
  }, [avatarSrc, effect.id, total, gameOnly]);

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

  // High five / parade / rocket: tap anywhere on this screen to replay.
  useEffect(() => {
    if (effect.game?.kind !== "replay" || playing) return;
    return tapToReplay(effect, avatarSrc);
  }, [effect, avatarSrc, playing]);

  // Closing the screen clears any effect still running (piñata, candy…).
  useEffect(() => () => stopAllCelebrations(), []);

  // What earned the points (plus any milestone unlocked), one at a time.
  const lines = [
    ...items.map((i) => `${i.isBonus ? "⭐ " : ""}${i.name} +${i.points}`),
    ...milestonesUnlocked.map((m) => `🏆 Unlocked: ${m.name}!`),
  ];
  // Hidden (but still taking up space, so the circle doesn't move under
  // the effect) until the points are revealed.
  const reveal = playing ? "invisible" : revealed ? "animate-celebrate-pop-in" : "invisible";
  // Some effects (the piñata) need the middle of the screen to themselves.
  const stage = effect.hidesStage || playing ? reveal : "";

  // Portal to <body>: the kid/parent panels use backdrop-blur, which would
  // otherwise trap this "fixed" screen inside the panel. The background is
  // its own layer (z-50) under the UI (z-60) so "Keep playing" games can run
  // full screen in between (canvasGame GAME_Z); effects go over the top.
  return createPortal(
    <>
      <div aria-hidden className="fixed inset-0 z-50 bg-celebrate" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={gameOnly ? effect.name : `${headline} ${total} points approved`}
        // While a game or a tap-to-unlock effect is going, swipes and drags
        // steer the game instead of scrolling the screen (phones cancel the
        // gesture otherwise).
        className={`fixed inset-0 z-[60] flex flex-col items-center px-6 pb-safe-bottom pt-6 overflow-y-auto ${
          playing || (effect.revealsPoints && !revealed) ? "touch-none" : ""
        }`}
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
          <div className={`relative mt-20 ${stage}`}>
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

        {playing && effect.game?.kind === "score" && (
          <div className="absolute left-4 top-4 flex items-center gap-2">
            <div
              ref={counterRef}
              aria-live="polite"
              className="rounded-full bg-white px-5 py-2 text-2xl font-black text-pp-primary shadow-sm tabular-nums"
            >
              <span aria-hidden>{effect.game.icon}</span> {score}
              <span className="sr-only"> {effect.game.label}</span>
            </div>
            {!timesUp && lives !== null && (effect.game.lives ?? 1) > 1 && (
              <div
                aria-label={`${lives} lives left`}
                className="rounded-full bg-white px-3 py-2 text-lg shadow-sm tracking-tight"
              >
                {Array.from({ length: Math.max(effect.game.lives ?? 0, lives) }, (_, i) => (i < lives ? "❤️" : "🤍")).join("")}
              </div>
            )}
            {!timesUp && best && best.score > 0 && (
              <div
                aria-label={`High score ${best.score} by ${best.initials}`}
                className="rounded-full bg-white px-3 py-2 text-sm font-bold text-pp-muted shadow-sm tabular-nums"
              >
                🏆 {best.score} · {best.initials}
              </div>
            )}
            {!timesUp && effect.game.seconds && (
              <div
                aria-label={`${timeLeft} seconds left`}
                className={`rounded-full bg-white px-4 py-2 text-lg font-bold shadow-sm tabular-nums ${
                  timeLeft <= 5 ? "text-rose-600 animate-pulse" : "text-pp-muted"
                }`}
              >
                ⏱ {timeLeft}s
              </div>
            )}
            {!timesUp && secondsLeft !== null && secondsLeft > 0 && secondsLeft <= SHOW_COUNTDOWN_SECONDS && (
              <div
                aria-label={`${Math.ceil(secondsLeft / 60)} minutes of playtime left`}
                title="Playtime left"
                className={`rounded-full bg-white px-3 py-2 text-sm font-bold shadow-sm tabular-nums ${
                  secondsLeft <= 30 ? "text-rose-600" : "text-pp-muted"
                }`}
              >
                {gameOnly ? "🎟️" : "⏳"} {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
              </div>
            )}
          </div>
        )}

        {playing && timesUp && effect.game?.kind === "score" && (
          <div className="absolute inset-0 flex items-center justify-center px-6">
            <div className="card w-full max-w-sm text-center animate-celebrate-pop-in">
              <p className="text-4xl font-semibold text-pp-primary">
                {effect.game.seconds ? "Time's up!" : "Game over!"}
              </p>
              <p className="mt-4 text-7xl font-black text-pp-primary tabular-nums">
                <span aria-hidden>{effect.game.icon}</span> {score}
              </p>
              <p className="mt-1 font-semibold text-pp-muted">{effect.game.label}</p>
              {newBest ? (
                <p className="mt-4 rounded-full bg-pp-tint px-4 py-2 font-bold text-pp-primary animate-celebrate-pop-in">
                  🎉 New high score!
                </p>
              ) : (
                best &&
                best.score > 0 && (
                  <p className="mt-4 font-semibold text-pp-muted tabular-nums">
                    🏆 High score: {best.score} · {best.initials}
                  </p>
                )
              )}
              <div className="mt-6 flex flex-col gap-3">
                {outOfTime ? (
                  <>
                    <p className="font-semibold text-pp-primary">
                      {gameOnly ? "That's all the time on this ticket! 🎟️" : "That's playtime for now!"}
                    </p>
                    <button type="button" onClick={onClose} className="btn-primary btn-lg w-full rounded-2xl">
                      Done
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setRound((n) => n + 1)}
                      className="btn-primary btn-lg w-full rounded-2xl"
                    >
                      Play again
                    </button>
                    <button type="button" onClick={onClose} className="btn-secondary w-full">
                      Done
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex w-full max-w-xl flex-col items-center gap-3">
          {playing ? (
            <button
              type="button"
              onClick={onClose}
              className={`btn-primary btn-lg w-full rounded-2xl h-16 ${timesUp ? "invisible" : ""}`}
            >
              Done
            </button>
          ) : (
            <>
              <button
                ref={buttonRef}
                type="button"
                onClick={onClose}
                className={`btn-primary btn-lg w-full rounded-2xl h-16 ${reveal}`}
              >
                {button}
              </button>
              {effect.game?.kind === "score" && (
                <button
                  type="button"
                  onClick={keepPlaying}
                  className={`font-semibold text-pp-primary underline underline-offset-4 ${reveal}`}
                >
                  Keep playing
                </button>
              )}
              {effect.game?.kind === "replay" && (
                <p className={`text-sm font-semibold text-pp-muted ${reveal}`}>
                  Tap anywhere to do it again!
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </>,
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
