import { playAvatarExplosion } from "./avatarExplosion";
import { playConfetti } from "./confetti";
import { playFireworks } from "./fireworks";
import { playHighFive } from "./highFive";
import { playBalloonGame, playBalloons } from "./balloons";
import { playJackpot } from "./jackpot";
import { playParade } from "./parade";
import { playPinata, playPinataGame } from "./pinata";
import { playRocket } from "./rocket";
import { playScratchCard } from "./scratchCard";
import {
  hintBubble,
  makeLayer,
  onStop,
  prefersReducedMotion,
  stopAllCelebrations,
  type CelebrationOptions,
  type GameOptions,
} from "./shared";
import { playWebglBurst } from "./webglBurst";

export type { CelebrationOptions, GameOptions } from "./shared";
export { isMuted, playSound, setMuted, unlockAudio } from "./sounds";
export { stopAllCelebrations } from "./shared";

export type Celebration = {
  id: string;
  name: string;
  description: string;
  // The kid has to do something (whack, pop, spin, scratch) before the
  // points show; the effect calls opts.onReveal() at the payoff.
  revealsPoints?: boolean;
  // Also hide the avatar + points circle until the reveal, for effects
  // that take over the middle of the screen (piñata, slot machine).
  hidesStage?: boolean;
  // "Keep playing" after the celebration: a score game with its own
  // counter, or tap-anywhere-to-replay.
  game?:
    | {
        kind: "score";
        icon: string;
        label: string;
        seconds: number; // length of a round
        start: (opts: GameOptions) => () => void;
      }
    | { kind: "replay" };
  play: (opts: CelebrationOptions) => Promise<void>;
};

// Every celebration the kid view can pick from (at random). Add new ones
// here and they show up in the parent gallery automatically.
export const CELEBRATIONS: Celebration[] = [
  {
    id: "confetti",
    name: "Confetti shower",
    description: "Cannons from both sides, then confetti raining down.",
    play: playConfetti,
  },
  {
    id: "fireworks",
    name: "Fireworks",
    description: "Bursts popping all over the screen.",
    play: playFireworks,
  },
  {
    id: "avatar-explosion",
    name: "Avatar go boom",
    description: "Their avatar wobbles, puffs up… and POPS into pieces.",
    play: playAvatarExplosion,
  },
  {
    id: "high-five",
    game: { kind: "replay" },
    name: "High five",
    description: "Two hands swing in and SMACK — burst, confetti, bounce. Keep playing: tap anywhere.",
    play: playHighFive,
  },
  {
    id: "starburst",
    name: "Starburst",
    description: "A swirling, glowing galaxy of sparks (WebGL).",
    play: playWebglBurst,
  },
  {
    id: "pinata",
    game: { kind: "score", icon: "🍬", label: "candy", seconds: 30, start: playPinataGame },
    revealsPoints: true,
    hidesStage: true,
    name: "Piñata",
    description: "Whack the llama three times — candy everywhere. Keep playing: endless piñatas, collect the candy.",
    play: playPinata,
  },
  {
    id: "balloons",
    game: { kind: "score", icon: "🎈", label: "popped", seconds: 30, start: playBalloonGame },
    revealsPoints: true,
    name: "Balloon pop",
    description: "Balloons float up; tap to jab them with the needle. Keep playing: endless balloons.",
    play: playBalloons,
  },
  {
    id: "rocket",
    game: { kind: "replay" },
    name: "Avatar rocket",
    description: "Blast off, a random trick, crash landing. Keep playing: tap to launch more.",
    play: playRocket,
  },
  {
    id: "parade",
    game: { kind: "replay" },
    name: "Avatar parade",
    description: "A conga line of mini avatars holding up signs. Keep playing: tap to send more.",
    play: playParade,
  },
  {
    id: "jackpot",
    revealsPoints: true,
    hidesStage: true,
    name: "Jackpot",
    description: "Tap to spin — the reels land on three avatars.",
    play: playJackpot,
  },
  {
    id: "scratch-card",
    revealsPoints: true,
    name: "Scratch card",
    description: "Scratch the silver foil off to reveal the points.",
    play: playScratchCard,
  },
];

export { prefersReducedMotion } from "./shared";

// The celebration with this id, or a random one.
export function pickCelebration(id?: string): Celebration {
  return (
    CELEBRATIONS.find((c) => c.id === id) ??
    CELEBRATIONS[Math.floor(Math.random() * CELEBRATIONS.length)]
  );
}

// Plays one celebration (random unless an id is given). With "reduce
// motion" on, plays nothing — the caller still shows its message (and
// reveals straight away).
export async function playCelebration(
  opts: CelebrationOptions,
  id?: string,
): Promise<void> {
  if (prefersReducedMotion()) {
    opts.onReveal?.();
    return;
  }
  stopAllCelebrations(); // one at a time
  await pickCelebration(id).play(opts);
}

const MAX_REPLAYS_AT_ONCE = 4;

// Starts a celebration's "Keep playing" game. Score games get the kid's
// score via onScore; replay games play the effect again wherever the kid
// taps (taps on buttons — like Done — are ignored). Returns a stop function.
export function startGame(celebration: Celebration, opts: GameOptions): () => void {
  stopAllCelebrations(); // clear the celebration's leftovers first
  const game = celebration.game;
  if (!game) return () => {};
  if (game.kind === "score") return game.start(opts);

  const hintLayer = makeLayer();
  const hint = hintBubble(hintLayer, "Tap anywhere!", window.innerHeight * 0.4);
  let running = 0;
  const onTap = (e: PointerEvent) => {
    if ((e.target as Element | null)?.closest("button")) return;
    if (running >= MAX_REPLAYS_AT_ONCE) return;
    hint.remove();
    running++;
    void celebration
      .play({ avatarSrc: opts.avatarSrc, at: { x: e.clientX, y: e.clientY }, points: 0 })
      .finally(() => running--);
  };
  window.addEventListener("pointerdown", onTap);
  const stop = () => {
    window.removeEventListener("pointerdown", onTap);
    hintLayer.remove();
  };
  onStop(stop);
  return stop;
}
