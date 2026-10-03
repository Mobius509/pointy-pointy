// Shared plumbing for the canvas arcade games (worm, chomper, asteroids):
// a full-screen canvas on an effect layer, a frame loop, pointer input,
// image loading, and token colors. Everything registers with the stop
// switch so closing the celebration screen tears it all down.

import { makeLayer, onStop, tokenRgb } from "./shared";

export type Area = { x: number; y: number; w: number; h: number };

export type CanvasGame = {
  layer: HTMLDivElement;
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  // Where the game is played. In "Keep playing" mode that's the whole
  // screen: the game runs underneath the score counter and Done button.
  area: Area;
  // The part of the screen clear of that UI — for things that must stay
  // visible (spawn spots, the maze, where the ship can fly).
  safe: Area;
};

// "Keep playing" games sit between the celebration screen's background and
// its buttons (CelebrationScreen: backdrop z-50, UI z-60).
const GAME_Z = 55;

export function createCanvasGame(mode: "celebration" | "game"): CanvasGame {
  const layer = makeLayer();
  if (mode === "game") layer.style.zIndex = String(GAME_Z);
  const W = window.innerWidth;
  const H = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const canvas = document.createElement("canvas");
  canvas.className = "absolute inset-0";
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  layer.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  if (mode === "celebration") {
    const area = { x: 12, y: 24, w: W - 24, h: H - 48 };
    return { layer, ctx, W, H, area, safe: area };
  }
  const top = 76;
  const bottom = 160; // the Done button, lifted clear of the phone's bottom edge (pb-safe-bottom)
  return { layer, ctx, W, H, area: { x: 0, y: 0, w: W, h: H }, safe: { x: 12, y: top, w: W - 24, h: H - top - bottom } };
}

// Calls `frame(dt, elapsed)` every animation frame (dt in seconds, capped so
// a backgrounded tab doesn't teleport things) until it returns false, the
// layer is removed, or the returned stop function is called.
export function runLoop(
  layer: HTMLElement,
  frame: (dt: number, elapsed: number) => boolean | void,
): () => void {
  let raf = 0;
  let stopped = false;
  const start = performance.now();
  let last = start;
  const tick = (now: number) => {
    if (stopped || !layer.isConnected) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (frame(dt, (now - start) / 1000) === false) return;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  const stop = () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
  onStop(stop);
  return stop;
}

// Pointer (touch + mouse) and arrow keys, on the window so the game canvas
// never blocks the screen's buttons — presses on buttons are ignored.
export function gameInput(handlers: {
  down?: (x: number, y: number) => void;
  move?: (x: number, y: number, pressed: boolean) => void;
  up?: (x: number, y: number) => void;
  key?: (dir: "up" | "down" | "left" | "right") => void;
}): () => void {
  let pressed = false;
  const onButton = (e: Event) => e.target instanceof Element && !!e.target.closest("button");
  const down = (e: PointerEvent) => {
    if (onButton(e)) return;
    pressed = true;
    handlers.down?.(e.clientX, e.clientY);
  };
  const move = (e: PointerEvent) => handlers.move?.(e.clientX, e.clientY, pressed);
  const up = (e: PointerEvent) => {
    if (!pressed) return;
    pressed = false;
    handlers.up?.(e.clientX, e.clientY);
  };
  const KEYS: Record<string, "up" | "down" | "left" | "right"> = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
  };
  const key = (e: KeyboardEvent) => {
    const dir = KEYS[e.key];
    if (dir && handlers.key) {
      e.preventDefault();
      handlers.key(dir);
    }
  };
  window.addEventListener("pointerdown", down);
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("keydown", key);
  const remove = () => {
    window.removeEventListener("pointerdown", down);
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("keydown", key);
  };
  onStop(remove);
  return remove;
}

// Loads an image; resolves null if there's no src or it fails, so callers
// can fall back to placeholder drawing until the real artwork exists.
export function loadImage(src?: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// A copy of `img` with a CSS filter baked in, e.g. a hue-rotate tint. Safari
// (so every iPhone, and the iOS app's web view) ignores canvas filters, so
// there the same color math is done on the pixels instead — otherwise every
// tinted ball, bubble and treat would come out the art's own color.
export function tinted(img: HTMLImageElement | HTMLCanvasElement, filter: string): HTMLCanvasElement | HTMLImageElement {
  const c = document.createElement("canvas");
  c.width = img instanceof HTMLImageElement ? img.naturalWidth : img.width;
  c.height = img instanceof HTMLImageElement ? img.naturalHeight : img.height;
  const g = c.getContext("2d", { willReadFrequently: true });
  if (!g || !c.width || !c.height) return img;
  if (canvasFilters()) {
    g.filter = filter;
    g.drawImage(img, 0, 0);
    return c;
  }
  g.drawImage(img, 0, 0);
  const steps = filterSteps(filter);
  if (!steps.length) return c;
  let pixels: ImageData;
  try {
    pixels = g.getImageData(0, 0, c.width, c.height);
  } catch {
    return c; // cross-origin image: can't read pixels
  }
  const d = pixels.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    let r = d[i] / 255;
    let gr = d[i + 1] / 255;
    let b = d[i + 2] / 255;
    for (const m of steps) {
      [r, gr, b] = [
        clamp01(m[0] * r + m[1] * gr + m[2] * b),
        clamp01(m[3] * r + m[4] * gr + m[5] * b),
        clamp01(m[6] * r + m[7] * gr + m[8] * b),
      ];
    }
    d[i] = r * 255;
    d[i + 1] = gr * 255;
    d[i + 2] = b * 255;
  }
  g.putImageData(pixels, 0, 0);
  return c;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Whether canvas filters work here: invert a white pixel and see.
let filtersWork: boolean | null = null;
function canvasFilters(): boolean {
  if (filtersWork !== null) return filtersWork;
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const g = c.getContext("2d", { willReadFrequently: true });
  if (!g || !("filter" in g)) return (filtersWork = false);
  g.fillStyle = "#fff";
  g.fillRect(0, 0, 1, 1);
  const probe = document.createElement("canvas");
  probe.width = probe.height = 1;
  const pg = probe.getContext("2d", { willReadFrequently: true });
  if (!pg) return (filtersWork = false);
  pg.filter = "invert(1)";
  pg.drawImage(c, 0, 0);
  return (filtersWork = pg.getImageData(0, 0, 1, 1).data[0] < 128);
}

// The filter functions we use (hue-rotate, saturate, grayscale, brightness),
// as the CSS spec's color matrices, in order.
function filterSteps(filter: string): number[][] {
  const steps: number[][] = [];
  for (const [, fn, raw] of filter.matchAll(/([a-z-]+)\(([^)]*)\)/g)) {
    const n = parseFloat(raw);
    const amount = raw.trim().endsWith("%") ? n / 100 : n;
    if (fn === "hue-rotate") {
      const a = (n * Math.PI) / 180; // degrees
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      steps.push([
        0.213 + cos * 0.787 - sin * 0.213, 0.715 - cos * 0.715 - sin * 0.715, 0.072 - cos * 0.072 + sin * 0.928,
        0.213 - cos * 0.213 + sin * 0.143, 0.715 + cos * 0.285 + sin * 0.14, 0.072 - cos * 0.072 - sin * 0.283,
        0.213 - cos * 0.213 - sin * 0.787, 0.715 - cos * 0.715 + sin * 0.715, 0.072 + cos * 0.928 + sin * 0.072,
      ]);
    } else if (fn === "saturate" || fn === "grayscale") {
      const s = fn === "saturate" ? amount : 1 - Math.min(1, amount);
      steps.push([
        0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
        0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
        0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
      ]);
    } else if (fn === "brightness") {
      steps.push([amount, 0, 0, 0, amount, 0, 0, 0, amount]);
    }
  }
  return steps;
}

// A copy of `img` cropped to its visible pixels (drops the empty margin
// around artwork like the avatars), so it can be sized and placed like art
// that has none.
export function trimmed(img: HTMLImageElement): HTMLCanvasElement | HTMLImageElement {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true });
  if (!g || !w || !h) return img;
  g.drawImage(img, 0, 0);
  let data: Uint8ClampedArray;
  try {
    data = g.getImageData(0, 0, w, h).data;
  } catch {
    return img; // cross-origin image: can't read pixels
  }
  let top = h, left = w, right = -1, bottom = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (data[(y * w + x) * 4 + 3] > 16) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
  if (right < 0) return img;
  const out = document.createElement("canvas");
  out.width = right - left + 1;
  out.height = bottom - top + 1;
  out.getContext("2d")?.drawImage(c, left, top, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

// "rgb(r,g,b)" / "rgba(r,g,b,a)" for a --pp-* token.
export function color(token: string, alpha = 1): string {
  const [r, g, b] = tokenRgb(token);
  return alpha === 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

// Splits the celebrated points into a few "+N" chunks for demos (worm
// pellets, asteroids…), e.g. 25 → [5, 5, 5, 5, 5].
export function pointChunks(points: number, max = 5): number[] {
  if (points <= 0) return [1, 1, 1];
  const n = Math.min(max, Math.max(1, points));
  const base = Math.floor(points / n);
  return Array.from({ length: n }, (_, i) => base + (i < points % n ? 1 : 0));
}

export const rand = (min: number, max: number) => min + Math.random() * (max - min);

export function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size = 18,
) {
  ctx.save();
  ctx.font = `900 ${size}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "white";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color("primary");
  ctx.fillText(text, x, y);
  ctx.restore();
}

// Tracks whether the kid has stopped interacting, so a celebration can
// play itself (like the piñata's auto-whack) if they don't touch it.
export function idleTracker(afterMs: number) {
  let last = performance.now();
  return {
    poke: () => (last = performance.now()),
    idle: () => performance.now() - last > afterMs,
  };
}
