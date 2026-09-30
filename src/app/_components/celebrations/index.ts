import { playAvatarExplosion } from "./avatarExplosion";
import { playConfetti } from "./confetti";
import { playFireworks } from "./fireworks";
import { prefersReducedMotion, type CelebrationOptions } from "./shared";
import { playWebglBurst } from "./webglBurst";

export type { CelebrationOptions } from "./shared";

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
    id: "starburst",
    name: "Starburst",
    description: "A swirling, glowing galaxy of sparks (WebGL).",
    play: playWebglBurst,
  },
];

// Plays one celebration (random unless an id is given). With "reduce
// motion" on, plays nothing — the caller still shows its message.
export async function playCelebration(
  opts: CelebrationOptions,
  id?: string,
): Promise<void> {
  if (prefersReducedMotion()) return;
  const pick =
    CELEBRATIONS.find((c) => c.id === id) ??
    CELEBRATIONS[Math.floor(Math.random() * CELEBRATIONS.length)];
  await pick.play(opts);
}
