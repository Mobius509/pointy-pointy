import { playAvatarExplosion } from "./avatarExplosion";
import { playConfetti } from "./confetti";
import { playFireworks } from "./fireworks";
import { playHighFive } from "./highFive";
import { playAsteroids, playAsteroidsGame } from "./asteroids";
import { playBalloonGame, playBalloons } from "./balloons";
import { playChomper, playChomperGame } from "./chomper";
import { playJackpot } from "./jackpot";
import { playMole, playMoleGame } from "./mole";
import { playFlappy, playFlappyGame } from "./flappy";
import { playStack, playStackGame } from "./stack";
import { playMarble, playMarbleGame } from "./marble";
import { playClaw, playClawGame } from "./claw";
import { playBubbles, playBubblesGame } from "./bubbles";
import { playPong, playPongGame } from "./pong";
import { playDoodle, playDoodleGame } from "./doodle";
import { playFall, playFallGame } from "./fall";
import { playParade } from "./parade";
import { playPinata, playPinataGame } from "./pinata";
import { playRocket } from "./rocket";
import { playScratchCard } from "./scratchCard";
import { playWorm, playWormGame } from "./worm";
import {
  prefersReducedMotion,
  stopAllCelebrations,
  type CelebrationOptions,
  type GameOptions,
} from "./shared";
import { playWebglBurst } from "./webglBurst";
import { ARCADE_GAMES } from "@/lib/games";

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
        // Timed round (piñata, balloons)…
        seconds?: number;
        // …or arcade lives, where the game ends itself (worm, chomper,
        // asteroids). 1 life = no hearts shown.
        lives?: number;
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
    description: "Two hands swing in and SMACK — burst, confetti, bounce. Tap anywhere to do it again.",
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
    description: "Blast off, a random trick, crash landing. Tap anywhere to launch more.",
    play: playRocket,
  },
  {
    id: "parade",
    game: { kind: "replay" },
    name: "Avatar parade",
    description: "A conga line of mini avatars holding up signs. Tap anywhere to send more.",
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
  },  {
    id: "worm",
    revealsPoints: true,
    hidesStage: true,
    game: { kind: "score", icon: "🍎", label: "treats", lives: 1, start: playWormGame },
    name: "Worm",
    description: "Steer the worm to a handful of treats. Keep playing: grow long — don't bite your tail!",
    play: playWorm,
  },
  {
    id: "chomper",
    revealsPoints: true,
    hidesStage: true,
    game: { kind: "score", icon: "😋", label: "chomps", lives: 3, start: playChomperGame },
    name: "Chomper",
    description: "A mini maze with two turns — tap to turn. Keep playing: dots, monsters, three lives.",
    play: playChomper,
  },
  {
    id: "mole",
    revealsPoints: true,
    hidesStage: true,
    game: { kind: "score", icon: "🔨", label: "bonks", seconds: 30, start: playMoleGame },
    name: "Whack-a-mole",
    description: "Bonk the moles holding the points. Keep playing: 30 seconds of moles — but don’t bonk your own avatar!",
    play: playMole,
  },
  {
    id: "flappy",
    revealsPoints: true,
    hidesStage: true,
    game: { kind: "score", icon: "🐦", label: "points", lives: 3, start: playFlappyGame },
    name: "Flappy bird",
    description: "Tap to flap through the gaps to grab the points. Keep playing: clear pipes and grab coins (+1 each). Three lives.",
    play: playFlappy,
  },
  {
    id: "stack",
    revealsPoints: true,
    hidesStage: true,
    game: { kind: "score", icon: "🧱", label: "blocks", lives: 3, start: playStackGame },
    name: "Block stack",
    description: "Slide the platform to catch the falling blocks and stack the points. Keep playing: build it tall — every block that falls costs a life.",
    play: playStack,
  },
  {
    id: "marble",
    revealsPoints: true,
    hidesStage: true,
    game: { kind: "score", icon: "🔮", label: "coins", seconds: 45, start: playMarbleGame },
    name: "Marble tilt",
    description: "Tilt the phone (or hold a finger) to roll a marble over the point coins. Keep playing: 45 seconds of coins.",
    play: playMarble,
  },
  {
    id: "claw",
    revealsPoints: true,
    hidesStage: true,
    game: { kind: "score", icon: "🎁", label: "points", lives: 5, start: playClawGame },
    name: "Claw machine",
    description: "Tap to drop the claw and grab prize balls — each pops open with an emoji and points. Keep playing: five tries — prizes, bombs, extra tries and rare specials (golden, magnet, iron claw, sticky claw, slow-mo, jackpot, shake-up, sneaky, mystery, skull, super bonus).",
    play: playClaw,
  },
  {
    id: "bubbles",
    revealsPoints: true,
    hidesStage: true,
    game: { kind: "score", icon: "🫧", label: "points", lives: 1, start: playBubblesGame },
    name: "Bubble shooter",
    description:
      "Aim the shooter and let go to fire — three or more bubbles of a color pop, and anything hanging from them drops. The points are on the \"+N\" bubbles. Keep playing: rows come down faster and faster until the bubbles reach the line — clear the board for a bonus and the next level, with new shapes and special bubbles (rainbow, stone, prize, skull, star, ice, bomb, ghost, lightning, chained); shiny pearls win power shots (fireball, rainbow, bomb, triple).",
    play: playBubbles,
  },
  {
    id: "asteroids",
    revealsPoints: true,
    hidesStage: true,
    game: { kind: "score", icon: "☄️", label: "rocks", lives: 3, start: playAsteroidsGame },
    name: "Asteroids",
    description: "Tap the rocks to blast them. Keep playing: each tap fires and flies the ship — three lives.",
    play: playAsteroids,
  },
  {
    id: "pong",
    revealsPoints: true,
    hidesStage: true,
    game: { kind: "score", icon: "🏓", label: "points", lives: 3, start: playPongGame },
    name: "Pong",
    description: "Drag to move your paddle and hit the ball back — each hit collects some of the points. Keep playing: a point every time it gets past the computer, which gets quicker as you go. Three lives.",
    play: playPong,
  },
  {
    id: "doodle",
    revealsPoints: true,
    hidesStage: true,
    game: { kind: "score", icon: "🦘", label: "platforms", lives: 3, start: playDoodleGame },
    name: "Sky jump",
    description: "Tap where you want to jump — your avatar hops up the platforms to grab the points. Keep playing: climb as high as you can (+1 a platform); some move, some crumble, springs throw you high. Three lives.",
    play: playDoodle,
  },
  {
    id: "fall",
    revealsPoints: true,
    hidesStage: true,
    game: { kind: "score", icon: "🪂", label: "gaps", lives: 3, start: playFallGame },
    name: "Free fall",
    description: "Hold to fall faster, slide to steer — slip through the gaps to grab the points. Keep playing: +1 a gap, and it keeps getting faster; clip a bar at speed and it's a crash (three lives). Grab a power orb to shoot straight down a line of gaps.",
    play: playFall,
  },

];

// The "score" games here must be exactly the arcade games (src/lib/games.ts).
if (process.env.NODE_ENV !== "production") {
  const games = CELEBRATIONS.filter((c) => c.game?.kind === "score").map((c) => c.id).sort().join(",");
  const arcade = ARCADE_GAMES.map((g) => g.id).sort().join(",");
  if (games !== arcade) console.warn(`[celebrations] score games (${games}) don't match ARCADE_GAMES (${arcade})`);
}

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
  try {
    await pickCelebration(id).play(opts);
  } catch (e) {
    // A broken effect must never leave the points hidden.
    console.error("[celebration]", e);
    opts.onReveal?.();
  }
}

const MAX_REPLAYS_AT_ONCE = 4;

// Starts a score game ("Keep playing" on the piñata / balloons). Clears
// the celebration's leftovers first. Returns a stop function.
export function startGame(celebration: Celebration, opts: GameOptions): () => void {
  if (celebration.game?.kind !== "score") return () => {};
  stopAllCelebrations();
  return celebration.game.start(opts);
}

// Replay effects (high five, parade, rocket): while the celebration screen
// is open, tapping anywhere (except buttons) plays it again right there.
// Returns a stop function.
export function tapToReplay(celebration: Celebration, avatarSrc: string): () => void {
  let running = 0;
  const onTap = (e: PointerEvent) => {
    if ((e.target as Element | null)?.closest("button")) return;
    if (running >= MAX_REPLAYS_AT_ONCE || prefersReducedMotion()) return;
    running++;
    void celebration
      .play({ avatarSrc, at: { x: e.clientX, y: e.clientY }, points: 0 })
      .finally(() => running--);
  };
  window.addEventListener("pointerdown", onTap);
  // Not registered with onStop: starting the celebration itself calls
  // stopAllCelebrations(), which would remove this listener. The screen
  // removes it when it closes.
  return () => window.removeEventListener("pointerdown", onTap);
}
