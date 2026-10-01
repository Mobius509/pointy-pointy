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
  laser: ["/sounds/laser.m4a", "/sounds/laser-2.m4a"],
} as const;

export type SoundKind = keyof typeof SOUNDS;

const VOLUME: Record<SoundKind, number> = { cheer: 0.9, pop: 0.8, boom: 0.6, laser: 0.5 };
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

// A cartoon "oww!" (no recording: a buzzy voice through two vowel filters
// sliding "ah" → "oo", with the pitch jumping up then falling). Every call
// is a little different — squeaky to deep, short to long, sometimes a
// double "ow-ow!" — so a run of bonks doesn't repeat itself.
export function playOw(): void {
  if (!ctx || ctx.state !== "running" || isMuted()) return;
  const twice = Math.random() < 0.2;
  const pitch = 200 + Math.random() * 380; // Hz
  const length = twice ? 0.18 : 0.28 + Math.random() * 0.3; // seconds
  const start = ctx.currentTime;
  ow(ctx, start, pitch, length);
  if (twice) ow(ctx, start + length + 0.05, pitch * 1.1, length * 1.2);
}

function ow(ac: AudioContext, at: number, pitch: number, length: number) {
  const end = at + length;
  const voice = ac.createOscillator();
  voice.type = "sawtooth";
  voice.frequency.setValueAtTime(pitch * 0.9, at);
  voice.frequency.linearRampToValueAtTime(pitch * 1.3, at + length * 0.2);
  voice.frequency.exponentialRampToValueAtTime(pitch * 0.6, end);
  // A little wobble in the voice.
  const wobble = ac.createOscillator();
  const wobbleDepth = ac.createGain();
  wobble.frequency.value = 6 + Math.random() * 3;
  wobbleDepth.gain.value = pitch * 0.04;
  wobble.connect(wobbleDepth).connect(voice.frequency);

  // Two vowel formants: "ah" (750 / 1150 Hz) closing to "oo" (350 / 650 Hz).
  const out = ac.createGain();
  out.gain.setValueAtTime(0.0001, at);
  out.gain.exponentialRampToValueAtTime(0.55, at + 0.02);
  out.gain.setValueAtTime(0.55, end - length * 0.4);
  out.gain.exponentialRampToValueAtTime(0.0001, end);
  for (const [from, to, q, level] of [
    [750, 350, 6, 1],
    [1150, 650, 9, 0.6],
  ]) {
    const formant = ac.createBiquadFilter();
    formant.type = "bandpass";
    formant.Q.value = q;
    formant.frequency.setValueAtTime(from, at);
    formant.frequency.exponentialRampToValueAtTime(to, end);
    const g = ac.createGain();
    g.gain.value = level * 2.5;
    voice.connect(formant).connect(g).connect(out);
  }
  out.connect(ac.destination);
  voice.start(at);
  wobble.start(at);
  voice.stop(end + 0.05);
  wobble.stop(end + 0.05);
}
