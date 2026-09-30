// Celebration sound effects (public/sounds, credits in CREDITS.md).
//
// Uses Web Audio: browsers (iPhone especially) only allow sound after a
// tap, so callers run unlockAudio() inside a tap handler; after that,
// effects can play sounds at any moment (e.g. the high-five smack).
// Muting is a per-device choice kept in browser storage.

const SOUNDS = {
  cheer: [
    "/sounds/cheer-group-yay.m4a",
    "/sounds/cheer-funny-yay.m4a",
    "/sounds/cheer-yay.m4a",
    "/sounds/cheer-woohoo.m4a",
    "/sounds/cheer-woohoo-cartoon.m4a",
    "/sounds/cheer-joyful.m4a",
  ],
  pop: ["/sounds/pop-cracker.m4a", "/sounds/pop-balloons.m4a"],
  boom: ["/sounds/boom.m4a"],
} as const;

export type SoundKind = keyof typeof SOUNDS;

const VOLUME: Record<SoundKind, number> = { cheer: 0.9, pop: 0.8, boom: 0.6 };
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
  void ctx.resume();
  for (const list of Object.values(SOUNDS)) for (const src of list) void load(src);
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

// Plays a random sound of the given kind. Silently does nothing if audio
// isn't unlocked, is muted, or the file fails to load.
export async function playSound(kind: SoundKind): Promise<void> {
  if (!ctx || ctx.state !== "running" || isMuted()) return;
  const list = SOUNDS[kind];
  const buffer = await load(list[Math.floor(Math.random() * list.length)]);
  if (!buffer || !ctx) return;
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.value = VOLUME[kind];
  source.buffer = buffer;
  source.connect(gain).connect(ctx.destination);
  source.start();
}
