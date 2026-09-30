import { playAvatarExplosion } from "./avatarExplosion";
import { playConfetti } from "./confetti";
import { playFireworks } from "./fireworks";
import { playHighFive } from "./highFive";
import { playBalloons } from "./balloons";
import { playJackpot } from "./jackpot";
import { playParade } from "./parade";
import { playPinata } from "./pinata";
import { playRocket } from "./rocket";
import { playScratchCard } from "./scratchCard";
import { prefersReducedMotion, stopAllCelebrations, type CelebrationOptions } from "./shared";
import { playWebglBurst } from "./webglBurst";

export type { CelebrationOptions } from "./shared";
export { isMuted, setMuted, unlockAudio } from "./sounds";
export { stopAllCelebrations } from "./shared";

export type Celebration = {
  id: string;
  name: string;
  description: string;
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
    name: "High five",
    description: "Two hands swing in and SMACK — burst, confetti, bounce.",
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
    name: "Piñata",
    description: "Tap to whack the llama three times — candy everywhere (throwable!).",
    play: playPinata,
  },
  {
    id: "balloons",
    name: "Balloon pop",
    description: "Balloons float up; tap to jab them with the needle.",
    play: playBalloons,
  },
  {
    id: "rocket",
    name: "Avatar rocket",
    description: "Blast off, loop-de-loop, crash landing.",
    play: playRocket,
  },
  {
    id: "parade",
    name: "Avatar parade",
    description: "A conga line of mini avatars holding up signs.",
    play: playParade,
  },
  {
    id: "jackpot",
    name: "Jackpot",
    description: "Slot machine reels land on three avatars.",
    play: playJackpot,
  },
  {
    id: "scratch-card",
    name: "Scratch card",
    description: "Scratch the silver foil off to reveal the points.",
    play: playScratchCard,
  },
];

// Plays one celebration (random unless an id is given). With "reduce
// motion" on, plays nothing — the caller still shows its message.
export async function playCelebration(
  opts: CelebrationOptions,
  id?: string,
): Promise<void> {
  if (prefersReducedMotion()) return;
  stopAllCelebrations(); // one at a time
  const pick =
    CELEBRATIONS.find((c) => c.id === id) ??
    CELEBRATIONS[Math.floor(Math.random() * CELEBRATIONS.length)];
  await pick.play(opts);
}
