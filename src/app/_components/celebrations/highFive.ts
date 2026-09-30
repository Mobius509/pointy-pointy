import confetti from "canvas-confetti";
import {
  BRAND,
  EFFECT_Z,
  PARTY,
  originPoint,
  tokenHex,
  wait,
  type CelebrationOptions,
} from "./shared";

const HAND_SRC = "/anims/highfivehand.png";
const HAND_ASPECT = 1114 / 834; // height / width of the artwork

// Burst line colors — Tailwind classes backed by the --pp-party-* tokens.
// Written out in full so Tailwind's scanner picks them up.
const BURST_CLASSES = [
  "bg-pp-party-yellow",
  "bg-pp-party-pink",
  "bg-pp-party-cyan",
  "bg-pp-party-red",
  "bg-pp-primary",
];

// Two hands swing in from the sides, wind up, and SMACK together over the
// avatar: burst lines, a confetti pop, "HIGH FIVE!", and the avatar
// bounces. Then the hands spring apart and slide away.
export async function playHighFive(opts: CelebrationOptions): Promise<void> {
  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.className = "pointer-events-none fixed inset-0 overflow-hidden";
  layer.style.zIndex = String(EFFECT_Z);
  document.body.appendChild(layer);

  // Make sure the artwork is decoded before it flies in.
  const probe = new Image();
  probe.src = HAND_SRC;
  await probe.decode().catch(() => {});

  const { x: cx, y: cy } = originPoint(opts.origin);
  const W = window.innerWidth;
  const handW = Math.min(W * 0.42, 230);
  const handH = handW * HAND_ASPECT;

  // Each hand is positioned by its palm center; the mirrored copy comes
  // from the left. `lean` tilts the fingers toward the other hand.
  const makeHand = (side: -1 | 1) => {
    const img = document.createElement("img");
    img.src = HAND_SRC;
    img.alt = "";
    img.className = "absolute select-none";
    Object.assign(img.style, {
      width: `${handW}px`,
      height: `${handH}px`,
      left: `${cx - handW / 2}px`,
      top: `${cy - handH * 0.55}px`,
    });
    layer.appendChild(img);
    const flip = side === -1 ? "scaleX(-1)" : "";
    const at = (dx: number, rot: number) =>
      `translateX(${dx * side}px) rotate(${rot * side}deg) ${flip}`;
    return { img, at };
  };

  const left = makeHand(-1);
  const right = makeHand(1);
  const off = W / 2 + handW; // fully off screen
  const contact = handW * 0.32; // palms overlap a touch at the smack

  const swing = (h: ReturnType<typeof makeHand>) =>
    h.img.animate(
      [
        { transform: h.at(off, 30), offset: 0 },
        { transform: h.at(handW * 0.9, 25), offset: 0.55 }, // swing in
        { transform: h.at(handW * 1.15, 38), offset: 0.8 }, // wind up
        { transform: h.at(contact, -4), offset: 1 }, // SMACK
      ],
      { duration: 900, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" },
    ).finished;

  await Promise.all([swing(left), swing(right)]);
  impact(layer, cx, cy, opts);

  const bounceOut = (h: ReturnType<typeof makeHand>) =>
    h.img.animate(
      [
        { transform: h.at(contact, -4) },
        { transform: h.at(contact + 40, 10), offset: 0.25 }, // recoil
        { transform: h.at(contact + 20, 4), offset: 0.55 }, // hang there
        { transform: h.at(off, 40) }, // away
      ],
      { duration: 1300, easing: "ease-in-out", fill: "forwards" },
    ).finished;

  await Promise.all([bounceOut(left), bounceOut(right)]);
  await wait(200);
  layer.remove();
}

function impact(layer: HTMLElement, cx: number, cy: number, opts: CelebrationOptions) {
  // Shake the whole layer for weight.
  layer.animate(
    [
      { transform: "translate(0,0)" },
      { transform: "translate(-7px,4px)" },
      { transform: "translate(6px,-5px)" },
      { transform: "translate(-4px,3px)" },
      { transform: "translate(0,0)" },
    ],
    { duration: 260 },
  );

  // Comic-book burst lines radiating from the contact point.
  const LINES = 14;
  for (let i = 0; i < LINES; i++) {
    const angle = (360 / LINES) * i + (Math.random() - 0.5) * 12;
    const line = document.createElement("div");
    line.className = `absolute rounded-full ${BURST_CLASSES[i % BURST_CLASSES.length]}`;
    const len = 50 + Math.random() * 40;
    Object.assign(line.style, {
      left: `${cx}px`,
      top: `${cy}px`,
      width: `${len}px`,
      height: "8px",
      transformOrigin: "0 50%",
    });
    layer.appendChild(line);
    line.animate(
      [
        { transform: `rotate(${angle}deg) translateX(40px) scaleX(0.2)`, opacity: 1 },
        { transform: `rotate(${angle}deg) translateX(120px) scaleX(1)`, opacity: 1, offset: 0.5 },
        { transform: `rotate(${angle}deg) translateX(190px) scaleX(0.3)`, opacity: 0 },
      ],
      { duration: 650, easing: "ease-out", fill: "forwards" },
    );
  }

  // Confetti pop from the smack.
  confetti({
    colors: tokenHex([...PARTY, ...BRAND]),
    zIndex: EFFECT_Z,
    disableForReducedMotion: true,
    particleCount: 90,
    spread: 360,
    startVelocity: 38,
    ticks: 120,
    scalar: 1.1,
    origin: { x: cx / window.innerWidth, y: cy / window.innerHeight },
  });

  // "HIGH FIVE!" slams in above the hands.
  const word = document.createElement("div");
  word.textContent = "HIGH FIVE!";
  word.className = "absolute font-black text-pp-primary text-outline-white whitespace-nowrap";
  Object.assign(word.style, {
    left: `${cx}px`,
    top: `${Math.max(60, cy - 190)}px`,
    fontSize: "clamp(40px, 11vw, 64px)",
  });
  layer.appendChild(word);
  word.animate(
    [
      { transform: "translateX(-50%) scale(0.2) rotate(-12deg)", opacity: 0 },
      { transform: "translateX(-50%) scale(1.15) rotate(-6deg)", opacity: 1, offset: 0.25 },
      { transform: "translateX(-50%) scale(1) rotate(-6deg)", opacity: 1, offset: 0.75 },
      { transform: "translateX(-50%) scale(1) rotate(-6deg)", opacity: 0 },
    ],
    { duration: 1500, easing: "ease-out", fill: "forwards" },
  );

  // The avatar gets knocked into a happy bounce.
  if (opts.origin) {
    opts.origin.animate(
      [
        { transform: "scale(1) rotate(0deg)" },
        { transform: "scale(0.8) rotate(-10deg)", offset: 0.2 },
        { transform: "scale(1.2) rotate(8deg)", offset: 0.5 },
        { transform: "scale(1) rotate(0deg)" },
      ],
      { duration: 700, easing: "ease-out" },
    );
  }
}
