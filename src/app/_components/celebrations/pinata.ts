import confetti from "canvas-confetti";
import { EMOJI_SOURCES, startEmojiPhysics, type EmojiPhysics } from "../emojiPhysics";
import {
  confettiStyle,
  explodeImage,
  flyToCounter,
  hintBubble,
  imageEl,
  makeLayer,
  onStop,
  shake,
  slamWord,
  wait,
  type CelebrationOptions,
  type GameOptions,
} from "./shared";
import { playSound } from "./sounds";

const PINATA_SRC = "/anims/pinata.webp";
const BAT_SRC = "/anims/bat.webp";
const PINATA_ASPECT = 932 / 697;
const BAT_ASPECT = 932 / 697;
const HITS_TO_BREAK = 3;
const HIT_WORDS = ["BONK!", "WHACK!", "POW!"];

// Hangs one piñata: it drops in on a string and swings; each tap swings the
// bat (BONK!) and the third hit bursts it into pieces. Resolves with where
// it was when it burst. With `autoHit`, the bat swings on its own if nobody
// taps (the one-off celebration); the endless game waits for the kid.
async function hangPinata(
  layer: HTMLElement,
  { autoHit, hint }: { autoHit: boolean; hint: boolean },
): Promise<DOMRect> {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const pw = Math.min(W * 0.5, 240);
  const ph = pw * PINATA_ASPECT;
  const stringLen = Math.max(40, H * 0.1);

  // Swinging rig: a string with the piñata hanging off it, pivoting at the
  // top of the screen.
  const rig = document.createElement("div");
  rig.className = "absolute cursor-pointer";
  Object.assign(rig.style, {
    left: `${W / 2 - pw / 2}px`,
    top: "0px",
    width: `${pw}px`,
    height: `${stringLen + ph}px`,
    transformOrigin: "50% 0",
    pointerEvents: "auto",
    touchAction: "manipulation",
  });
  const string = document.createElement("div");
  string.className = "absolute left-1/2 top-0 w-0.5 -translate-x-1/2 bg-pp-muted";
  string.style.height = `${stringLen + ph * 0.12}px`;
  const pinata = imageEl(PINATA_SRC);
  Object.assign(pinata.style, { left: "0", top: `${stringLen}px`, width: `${pw}px`, height: `${ph}px` });
  rig.append(string, pinata);
  layer.appendChild(rig);

  const hintEl = hint ? hintBubble(layer, "Tap to whack it!", stringLen + ph + 12) : null;

  const bat = imageEl(BAT_SRC, "absolute select-none opacity-0");
  const bw = pw * 0.9;
  Object.assign(bat.style, {
    width: `${bw}px`,
    height: `${bw * BAT_ASPECT}px`,
    left: `${W / 2}px`,
    top: `${stringLen + ph * 0.35}px`,
    // Pivot at the handle (bottom-left of the artwork).
    transformOrigin: "18% 86%",
  });
  layer.appendChild(bat);

  // Drop in, then swing (until it breaks).
  await rig.animate(
    [{ transform: `translateY(${-(stringLen + ph)}px)` }, { transform: "translateY(12px)", offset: 0.8 }, { transform: "translateY(0)" }],
    { duration: 650, easing: "ease-out" },
  ).finished;
  const swing = rig.animate(
    [{ transform: "rotate(-12deg)" }, { transform: "rotate(12deg)" }],
    { duration: 1400, iterations: Infinity, direction: "alternate", easing: "ease-in-out" },
  );

  let hits = 0;
  let busy = false;
  let broken!: () => void;
  const done = new Promise<void>((r) => (broken = r));
  let idle: ReturnType<typeof setTimeout> | undefined;
  onStop(() => clearTimeout(idle));
  const armAutoHit = (ms: number) => {
    if (!autoHit) return;
    clearTimeout(idle);
    idle = setTimeout(() => void hit(), ms);
  };

  async function hit() {
    if (busy || hits >= HITS_TO_BREAK) return;
    busy = true;
    hits++;
    hintEl?.remove();

    // Wind up and swing through the piñata.
    const swingBat = bat.animate(
      [
        { transform: "rotate(70deg)", opacity: 1 },
        { transform: "rotate(-35deg)", opacity: 1, offset: 0.55 },
        { transform: "rotate(-20deg)", opacity: 0 },
      ],
      { duration: 420, easing: "cubic-bezier(.6,0,.4,1)" },
    );
    await wait(200); // contact
    void playSound("pop");
    shake(layer, 6 + hits * 2);
    const r = pinata.getBoundingClientRect();
    slamWord(layer, HIT_WORDS[hits - 1], r.left + r.width / 2, r.top + r.height * 0.3, {
      size: "clamp(32px, 9vw, 52px)",
      duration: 800,
      tilt: hits % 2 ? -10 : 8,
    });
    pinata.animate(
      [{ transform: "rotate(0)" }, { transform: "rotate(-22deg) scale(0.93)" }, { transform: "rotate(0)" }],
      { duration: 350, easing: "ease-out" },
    );
    confetti({
      ...confettiStyle(),
      particleCount: 18,
      spread: 90,
      startVelocity: 22,
      origin: { x: (r.left + r.width / 2) / W, y: (r.top + r.height / 2) / H },
    });
    await swingBat.finished;
    busy = false;

    if (hits >= HITS_TO_BREAK) {
      clearTimeout(idle);
      broken();
    } else {
      armAutoHit(1600);
    }
  }

  rig.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    void hit();
  });
  armAutoHit(3500);
  await done;

  // BREAK!
  swing.pause();
  const r = pinata.getBoundingClientRect();
  rig.remove();
  bat.remove();
  shake(layer, 12);
  void explodeImage(layer, PINATA_SRC, r, 5);
  confetti({
    ...confettiStyle(),
    particleCount: 120,
    spread: 360,
    startVelocity: 40,
    ticks: 160,
    origin: { x: (r.left + r.width / 2) / W, y: (r.top + r.height / 2) / H },
  });
  return r;
}

function candySources(avatarSrc: string): string[] {
  const candy = [...EMOJI_SOURCES].sort(() => Math.random() - 0.5).slice(0, 10);
  return [avatarSrc, ...candy, avatarSrc];
}

function candyEngine(layer: HTMLElement, avatarSrc: string, extra: Partial<Parameters<typeof startEmojiPhysics>[0]> = {}): EmojiPhysics {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const size = Math.min(W * 0.2, 96);
  const engine = startEmojiPhysics({
    back: layer,
    front: layer,
    sources: candySources(avatarSrc),
    count: 0,
    sizeMin: size * 0.75,
    sizeMax: size,
    backRatio: 0,
    // Pile up above the screen's bottom button so it stays tappable.
    mode: { kind: "burst", x: W / 2, y: H / 2, floor: H - 120 },
    ...extra,
  });
  onStop(() => engine.stop());
  return engine;
}

// The celebration: one piñata, three whacks (or auto-whacks), then it
// bursts — the points are revealed and throwable candy piles up.
export async function playPinata(opts: CelebrationOptions): Promise<void> {
  const layer = makeLayer();
  const r = await hangPinata(layer, { autoHit: true, hint: true });
  opts.onReveal?.();
  void playSound("boom");
  setTimeout(() => void playSound("cheer"), 250);
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  slamWord(layer, "CANDY!", cx, Math.max(60, r.top - 10), { duration: 1400 });

  const engine = candyEngine(layer, opts.avatarSrc);
  engine.burst(cx, cy, 12);

  // Let them play with the pile, then fade it away.
  await wait(8500);
  await layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 600, fill: "forwards" }).finished;
  engine.stop();
  layer.remove();
}

// "Keep playing": piñata after piñata, no timer. Each holds a random amount
// of candy; tapping a piece collects it into the counter (dragging still
// throws it). Returns a stop function.
export function playPinataGame(opts: GameOptions): () => void {
  const layer = makeLayer();
  let stopped = false;
  let collected = 0;

  const engine = candyEngine(layer, opts.avatarSrc, {
    maxParticles: 40,
    onTap: (el) => {
      void playSound("pop");
      opts.onScore(++collected);
      void flyToCounter(el, opts.counter);
    },
  });

  void (async () => {
    let first = true;
    while (!stopped) {
      const r = await hangPinata(layer, { autoHit: false, hint: first });
      if (stopped) return;
      first = false;
      void playSound("cheer");
      // Some piñatas are stingy, some are loaded.
      const amount = 3 + Math.floor(Math.random() * 14);
      slamWord(layer, amount >= 12 ? "JACKPOT!" : amount <= 5 ? "Aww…" : `${amount} CANDY!`, r.left + r.width / 2, Math.max(60, r.top - 10), {
        size: "clamp(30px, 8vw, 48px)",
        duration: 1100,
      });
      engine.burst(r.left + r.width / 2, r.top + r.height / 2, amount);
      await wait(900); // next piñata
    }
  })();

  const stop = () => {
    stopped = true;
    engine.stop();
    layer.remove();
  };
  onStop(stop);
  return stop;
}
