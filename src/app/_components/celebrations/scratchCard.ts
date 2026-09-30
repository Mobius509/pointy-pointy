import confetti from "canvas-confetti";
import {
  confettiStyle,
  imageEl,
  makeLayer,
  slamWord,
  tokenRgb,
  wait,
  type CelebrationOptions,
} from "./shared";
import { playSound } from "./sounds";

const REVEAL_AT = 0.5; // share of the foil scratched off before it clears
const AUTO_AFTER_MS = 5000; // nobody scratching? do it for them

// Silver foil covers the points circle; scratch it off with a finger to
// reveal the points. Without the screen (gallery "Play"), it brings its
// own little card showing the points.
export async function playScratchCard(opts: CelebrationOptions): Promise<void> {
  const layer = makeLayer();
  const W = window.innerWidth;
  const H = window.innerHeight;

  // What gets covered: the screen's points circle, or a fallback card.
  let rect: DOMRect | { left: number; top: number; width: number; height: number };
  if (opts.target) {
    rect = opts.target.getBoundingClientRect();
  } else {
    const d = Math.min(W * 0.55, 220);
    rect = { left: W / 2 - d / 2, top: H / 2 - d / 2, width: d, height: d };
    const card = document.createElement("div");
    card.className =
      "absolute flex items-center justify-center rounded-full bg-white text-6xl font-black text-pp-primary shadow-lg";
    Object.assign(card.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${d}px`, height: `${d}px` });
    card.textContent = `+${opts.points ?? 0}`;
    layer.appendChild(card);
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  canvas.className = "absolute rounded-full cursor-crosshair";
  Object.assign(canvas.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    pointerEvents: "auto",
    touchAction: "none",
  });
  layer.appendChild(canvas);

  // Keep the avatar peeking over the top of the foil.
  const origin = opts.origin?.getBoundingClientRect();
  if (origin) {
    const peek = imageEl(opts.avatarSrc);
    Object.assign(peek.style, {
      left: `${origin.left}px`,
      top: `${origin.top}px`,
      width: `${origin.width}px`,
      height: `${origin.height}px`,
    });
    layer.appendChild(peek);
  }

  // Paint the foil: silver gradient, diagonal sheen, "SCRATCH ME!".
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  const w = rect.width;
  const h = rect.height;
  const rgb = (n: string) => `rgb(${tokenRgb(n).join(",")})`;
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, rgb("foil-light"));
  grad.addColorStop(0.5, rgb("foil-dark"));
  grad.addColorStop(1, rgb("foil-light"));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "white";
  for (let x = -h; x < w; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, h);
    ctx.lineTo(x + 8, h);
    ctx.lineTo(x + h + 8, 0);
    ctx.lineTo(x + h, 0);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = rgb("primary");
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${Math.round(w * 0.11)}px system-ui, sans-serif`;
  ctx.fillText("SCRATCH", w / 2, h * 0.52);
  ctx.fillText("ME! ✨", w / 2, h * 0.66);

  // Scratching erases the foil.
  ctx.globalCompositeOperation = "destination-out";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = w * 0.18;

  let last: { x: number; y: number } | null = null;
  let strokes = 0;
  let revealed = false;
  let touched = false;
  let reveal!: () => void;
  const done = new Promise<void>((r) => (reveal = r));

  const scratchTo = (x: number, y: number) => {
    ctx.beginPath();
    ctx.moveTo(last?.x ?? x, last?.y ?? y);
    ctx.lineTo(x, y);
    ctx.stroke();
    last = { x, y };
    if (++strokes % 6 === 0 && cleared() >= REVEAL_AT) finish();
  };

  // Share of foil pixels erased (sampled every 4th pixel for speed).
  const cleared = () => {
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let clear = 0;
    let total = 0;
    for (let i = 3; i < data.length; i += 16) {
      total++;
      if (data[i] < 40) clear++;
    }
    return clear / total;
  };

  const local = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    touched = true;
    canvas.setPointerCapture(e.pointerId);
    last = null;
    const p = local(e);
    scratchTo(p.x, p.y);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!canvas.hasPointerCapture(e.pointerId)) return;
    const p = local(e);
    scratchTo(p.x, p.y);
  });
  canvas.addEventListener("pointerup", () => (last = null));

  function finish() {
    if (revealed) return;
    revealed = true;
    reveal();
  }

  // Nobody scratching? Zig-zag it clean for them.
  setTimeout(async () => {
    if (touched || revealed) return;
    last = null;
    for (let i = 0; i <= 24 && !revealed; i++) {
      const row = i / 24;
      scratchTo(i % 2 ? w * 0.9 : w * 0.1, h * (0.1 + row * 0.8));
      await wait(45);
    }
    finish();
  }, AUTO_AFTER_MS);

  await done;

  void playSound("pop");
  setTimeout(() => void playSound("cheer"), 150);
  await canvas.animate(
    [{ transform: "scale(1)", opacity: 1 }, { transform: "scale(1.15)", opacity: 0 }],
    { duration: 320, easing: "ease-out", fill: "forwards" },
  ).finished;
  canvas.remove();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  confetti({ ...confettiStyle(), particleCount: 100, spread: 360, startVelocity: 35, origin: { x: cx / W, y: cy / H } });
  slamWord(layer, `+${opts.points ?? 0}!`, cx, Math.max(60, rect.top - 30), { duration: 1300 });
  await wait(opts.target ? 1400 : 2200);
  layer.remove();
}
