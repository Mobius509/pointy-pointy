// Celebration sound effects (public/sounds, credits in CREDITS.md).
//
// Uses Web Audio: browsers (iPhone especially) only allow sound after a
// tap, so callers run unlockAudio() inside a tap handler; after that,
// effects can play sounds at any moment (e.g. the high-five smack).
// Muting is a per-device choice kept in browser storage.

const YAYS = [
  "/sounds/cheer-group-yay.m4a",
  "/sounds/cheer-funny-yay.m4a",
  "/sounds/cheer-yay.m4a",
  "/sounds/cheer-woohoo.m4a",
  "/sounds/cheer-woohoo-cartoon.m4a",
  "/sounds/cheer-joyful.m4a",
];
const FANFARES = ["/sounds/fanfare.m4a", "/sounds/fanfare-2.m4a", "/sounds/fanfare-3.m4a"];

const SOUNDS = {
  cheer: [...YAYS, ...FANFARES], // any happy sound
  yay: YAYS, // just the voices
  fanfare: FANFARES,
  pop: ["/sounds/pop-cracker.m4a", "/sounds/pop-balloons.m4a"],
  boom: ["/sounds/boom.m4a"],
  laser: ["/sounds/laser.m4a", "/sounds/laser-2.m4a"],
  explode: [1, 2, 3, 4].map((n) => `/sounds/explode-${n}.m4a`),
  thud: [1, 2, 3, 4].map((n) => `/sounds/thud-${n}.m4a`),
  powerUp: ["/sounds/power-up.m4a"],
  flap: ["/sounds/flap.m4a"],
  clawDown: ["/sounds/claw-down.m4a"],
  clawOpen: ["/sounds/claw-open.m4a"],
  clawMove: ["/sounds/claw-move-1.m4a", "/sounds/claw-move-2.m4a"],
  waka: ["/sounds/waka-1.m4a", "/sounds/waka-2.m4a"], // played in turn: "waka-waka"
  ow: [1, 2, 3, 4, 5, 6, 7].map((n) => `/sounds/ow-${n}.m4a`),
  whoops: ["/sounds/whoopsie.m4a"],
};

export type SoundKind = keyof typeof SOUNDS;

const VOLUME: Record<SoundKind, number> = { cheer: 0.9, yay: 0.9, pop: 0.8, boom: 0.6, laser: 0.5, ow: 0.9, fanfare: 0.8, explode: 0.7, thud: 0.9, powerUp: 0.7, waka: 0.6, flap: 0.8, clawDown: 0.7, clawOpen: 0.7, clawMove: 0.45, whoops: 0.8 };
const MUTE_KEY = "pp:sound-muted";

let ctx: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* ignore */
  }
}

// Call from a tap/click handler. Creates (or resumes) the audio context and
// starts downloading the sounds so the first one plays on time.
export function unlockAudio() {
  if (typeof window === "undefined") return;
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state !== "running") {
    void ctx.resume();
    // iPhone also wants a sound actually started inside the tap: a silent
    // one-sample blip does it.
    const blip = ctx.createBufferSource();
    blip.buffer = ctx.createBuffer(1, 1, 22050);
    blip.connect(ctx.destination);
    blip.start(0);
  }
  if (!preloaded) {
    preloaded = true;
    for (const list of Object.values(SOUNDS)) for (const src of list) void load(src);
  }
}
let preloaded = false;

// iPhone Safari only lets a tap unlock sound when the finger lifts (touchend /
// pointerup / click) — not on touch-down, which is when the games listen. So
// every tap anywhere also tries to unlock, which also brings sound back after
// switching apps (the audio gets "interrupted").
if (typeof window !== "undefined") {
  for (const type of ["pointerup", "touchend", "click", "keydown"]) {
    window.addEventListener(type, unlockAudio, { capture: true, passive: true });
  }
}

function load(src: string): Promise<AudioBuffer | null> {
  let p = buffers.get(src);
  if (!p) {
    p = fetch(src)
      .then((r) => r.arrayBuffer())
      .then((data) => ctx!.decodeAudioData(data))
      .catch(() => null);
    buffers.set(src, p);
  }
  return p;
}

// Plays a random sound of the given kind — or, with `which`, that one in
// turn (e.g. alternating the two "waka" sounds). Silently does nothing if
// audio isn't unlocked, is muted, or the file fails to load.
export async function playSound(kind: SoundKind, which?: number): Promise<void> {
  if (!ctx || ctx.state !== "running" || isMuted()) return;
  const list = SOUNDS[kind];
  const i = which === undefined ? Math.floor(Math.random() * list.length) : which % list.length;
  const buffer = await load(list[i]);
  if (!buffer || !ctx) return;
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.value = VOLUME[kind];
  source.buffer = buffer;
  source.connect(gain).connect(ctx.destination);
  source.start();
}
