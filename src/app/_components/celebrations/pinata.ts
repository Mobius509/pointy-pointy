import confetti from "canvas-confetti";
import { EMOJI_SOURCES, startEmojiPhysics } from "../emojiPhysics";
import {
  confettiStyle,
  explodeImage,
  hintBubble,
  imageEl,
  makeLayer,
  onStop,
  shake,
  slamWord,
  wait,
  type CelebrationOptions,
} from "./shared";
import { playSound } from "./sounds";

const PINATA_SRC = "/anims/pinata.webp";
const BAT_SRC = "/anims/bat.webp";
const PINATA_ASPECT = 932 / 697;
const BAT_ASPECT = 932 / 697;
const HITS_TO_BREAK = 3;
const HIT_WORDS = ["BONK!", "WHACK!", "POW!"];

// The llama piñata drops in on a string and swings. Each tap swings the bat
// (BONK!); three hits and it bursts into pieces, spilling candy — emojis
// plus the kid's avatar — that piles up at the bottom and can be thrown
// around. If nobody taps, the bat swings on its own.
export async function playPinata(opts: CelebrationOptions): Promise<void> {
  const layer = makeLayer();
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

  const hint = hintBubble(layer, "Tap to whack it!", stringLen + ph + 12);

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

  // Drop in, then swing forever (until it breaks).
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
  let idle: ReturnType<typeof setTimeout>;
  onStop(() => clearTimeout(idle));
  const armAutoHit = (ms: number) => {
    clearTimeout(idle);
    idle = setTimeout(() => void hit(), ms);
  };

  async function hit() {
    if (busy || hits >= HITS_TO_BREAK) return;
    busy = true;
    hits++;
    hint.remove();

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

  // BREAK! Burst the piñata and spill candy.
  swing.pause();
  const r = pinata.getBoundingClientRect();
  rig.remove();
  void playSound("boom");
  setTimeout(() => void playSound("cheer"), 250);
  shake(layer, 12);
  const pieces = explodeImage(layer, PINATA_SRC, r, 5);
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  confetti({ ...confettiStyle(), particleCount: 120, spread: 360, startVelocity: 40, ticks: 160, origin: { x: cx / W, y: cy / H } });
  slamWord(layer, "CANDY!", cx, Math.max(60, r.top - 10), { duration: 1400 });

  const candy = [...EMOJI_SOURCES].sort(() => Math.random() - 0.5).slice(0, 10);
  const size = Math.min(W * 0.2, 96);
  const engine = startEmojiPhysics({
    back: layer,
    front: layer,
    sources: [opts.avatarSrc, ...candy, opts.avatarSrc],
    count: 12,
    sizeMin: size * 0.75,
    sizeMax: size,
    backRatio: 0,
    // Pile up above the screen's OK button so it stays tappable.
    mode: { kind: "burst", x: cx, y: cy, floor: H - 120 },
  });
  const unregisterCandy = onStop(() => engine.stop());

  await pieces;
  // Let them play with the pile, then fade it away.
  await wait(7000);
  await layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 600, fill: "forwards" }).finished;
  unregisterCandy();
  engine.stop();
  layer.remove();
}
