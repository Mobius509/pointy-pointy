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
  const bottom = 116;
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

// A copy of `img` with a CSS filter baked in, e.g. a hue-rotate tint
// (browsers without canvas filters just get the original color).
export function tinted(img: HTMLImageElement | HTMLCanvasElement, filter: string): HTMLCanvasElement | HTMLImageElement {
  const c = document.createElement("canvas");
  c.width = img instanceof HTMLImageElement ? img.naturalWidth : img.width;
  c.height = img instanceof HTMLImageElement ? img.naturalHeight : img.height;
  const g = c.getContext("2d");
  if (!g || !c.width || !c.height) return img;
  g.filter = filter;
  g.drawImage(img, 0, 0);
  return c;
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
