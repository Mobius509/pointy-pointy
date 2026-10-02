import confetti from "canvas-confetti";

// Helpers shared by the celebration effects. Colors come from the tokens
// in globals.css (no hex literals here — see the one-stylesheet rule).

export type CelebrationOptions = {
  avatarSrc: string;
  // The on-screen avatar the effect should play from (the "You earned"
  // screen's avatar). Effects fall back to the viewport center without it.
  origin?: HTMLElement | null;
  // The white points circle, for effects that cover/reveal it (scratch card).
  target?: HTMLElement | null;
  // Points being celebrated (parade signs, scratch-card fallback).
  points?: number;
  // "Reveal" effects (piñata, jackpot, balloons, scratch card) call this at
  // their payoff moment; the screen keeps the points hidden until then.
  onReveal?: () => void;
  // Play from this point instead of the avatar (tap-to-replay games).
  at?: { x: number; y: number };
};

// "Keep playing" mini games.
export type GameOptions = {
  avatarSrc: string;
  // Where the score counter sits, for collected things to fly into.
  counter?: { x: number; y: number };
  onScore: (score: number) => void;
  // Arcade games with consequences: lives left, and the end of the game.
  onLives?: (lives: number) => void;
  onGameOver?: () => void;
};

export const PARTY = ["party-pink", "party-yellow", "party-cyan", "party-red"];
export const BRAND = ["primary", "accent"];

// "R G B" channels for a --pp-* token.
export function tokenRgb(name: string): [number, number, number] {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(`--pp-${name}`)
    .trim();
  const [r, g, b] = raw.split(/\s+/).map(Number);
  return [r || 0, g || 0, b || 0];
}

// canvas-confetti needs "#rrggbb" strings.
export function tokenHex(names: string[]): string[] {
  return names.map((n) =>
    "#" + tokenRgb(n).map((c) => c.toString(16).padStart(2, "0")).join(""),
  );
}

export function originPoint(
  el?: HTMLElement | null,
  at?: { x: number; y: number },
): { x: number; y: number } {
  if (at) return at;
  if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Effects draw above the celebration screen (z-60) but never block taps.
export const EFFECT_Z = 70;

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// The confetti look — the confetti shower's side cannons: party + brand
// colors in the library's default mix of squares and circles. The top
// rain and every other effect's confetti use it too, so it all matches.
export function confettiStyle() {
  return {
    colors: tokenHex([...PARTY, ...BRAND]),
    zIndex: EFFECT_Z,
    disableForReducedMotion: true,
  };
}

// ----- Stop switch -----------------------------------------------------------
// Everything an effect puts on screen or keeps running registers a cleanup
// here, so closing the celebration screen (or starting another one) can
// clear it all at once — nothing lingers over the next screen.
const cleanups = new Set<() => void>();

export function onStop(fn: () => void): () => void {
  cleanups.add(fn);
  return () => cleanups.delete(fn);
}

export function stopAllCelebrations() {
  for (const fn of [...cleanups]) {
    try {
      fn();
    } catch {
      /* already gone */
    }
  }
  cleanups.clear();
  confetti.reset();
}

// Fades a canvas game's layer away as the points are revealed, so nothing
// is left drawn over the points screen. Resolves when it's gone.
export async function fadeOutLayer(layer: HTMLElement, delay = 0): Promise<void> {
  try {
    await layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, delay, fill: "forwards" }).finished;
  } catch {
    /* removed mid-fade */
  }
}

// A full-screen layer for an effect. Non-interactive layers let every tap
// through; interactive effects opt individual elements back in with
// `pointer-events: auto`.
export function makeLayer(): HTMLDivElement {
  const layer = document.createElement("div");
  layer.className = "pointer-events-none fixed inset-0 overflow-hidden";
  layer.style.zIndex = String(EFFECT_Z);
  document.body.appendChild(layer);
  const unregister = onStop(() => layer.remove());
  // Unregister when the effect removes the layer itself.
  const observer = new MutationObserver(() => {
    if (!layer.isConnected) {
      unregister();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true });
  return layer;
}

export function imageEl(src: string, className = "absolute select-none"): HTMLImageElement {
  const img = document.createElement("img");
  img.src = src;
  img.alt = "";
  img.draggable = false;
  img.className = className;
  return img;
}

// Quick screen shake for impacts.
export function shake(el: HTMLElement, strength = 7) {
  const s = strength;
  el.animate(
    [
      { transform: "translate(0,0)" },
      { transform: `translate(${-s}px,${s * 0.6}px)` },
      { transform: `translate(${s * 0.85}px,${-s * 0.7}px)` },
      { transform: `translate(${-s * 0.55}px,${s * 0.4}px)` },
      { transform: "translate(0,0)" },
    ],
    { duration: 260 },
  );
}

// Big comic word ("BONK!", "JACKPOT!") that slams in and fades.
export function slamWord(
  layer: HTMLElement,
  text: string,
  x: number,
  y: number,
  opts: { size?: string; duration?: number; tilt?: number } = {},
) {
  const word = document.createElement("div");
  word.textContent = text;
  word.className = "absolute font-black text-pp-primary text-outline-white whitespace-nowrap";
  Object.assign(word.style, {
    left: `${x}px`,
    top: `${y}px`,
    fontSize: opts.size ?? "clamp(40px, 11vw, 64px)",
  });
  layer.appendChild(word);
  const tilt = opts.tilt ?? -6;
  const t = (scale: number) => `translate(-50%, -50%) scale(${scale}) rotate(${tilt}deg)`;
  word
    .animate(
      [
        { transform: t(0.2), opacity: 0 },
        { transform: t(1.15), opacity: 1, offset: 0.25 },
        { transform: t(1), opacity: 1, offset: 0.75 },
        { transform: t(1), opacity: 0 },
      ],
      { duration: opts.duration ?? 1200, easing: "ease-out", fill: "forwards" },
    )
    .finished.then(() => word.remove());
}

// Slices an image into a grid of tiles that fly outward, spin, and fade —
// the "avatar go boom" / piñata burst. Resolves when the tiles are gone.
export function explodeImage(
  layer: HTMLElement,
  src: string,
  rect: { left: number; top: number; width: number; height: number },
  grid = 6,
): Promise<unknown> {
  const tw = rect.width / grid;
  const th = rect.height / grid;
  const flights: Promise<unknown>[] = [];
  for (let row = 0; row < grid; row++) {
    for (let col = 0; col < grid; col++) {
      const tile = document.createElement("div");
      tile.className = "absolute";
      Object.assign(tile.style, {
        left: `${rect.left + col * tw}px`,
        top: `${rect.top + row * th}px`,
        width: `${tw}px`,
        height: `${th}px`,
        backgroundImage: `url("${src}")`,
        backgroundSize: `${rect.width}px ${rect.height}px`,
        backgroundPosition: `${-col * tw}px ${-row * th}px`,
      });
      layer.appendChild(tile);

      // Fly away from the center, a little randomized, with some gravity.
      const dx = col - (grid - 1) / 2 + (Math.random() - 0.5);
      const dy = row - (grid - 1) / 2 + (Math.random() - 0.5);
      const len = Math.hypot(dx, dy) || 1;
      const dist = 250 + Math.random() * 450;
      const tx = (dx / len) * dist;
      const ty = (dy / len) * dist + 120;
      const spin = (Math.random() - 0.5) * 900;
      flights.push(
        tile
          .animate(
            [
              { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
              { opacity: 1, offset: 0.6 },
              { transform: `translate(${tx}px, ${ty}px) rotate(${spin}deg)`, opacity: 0 },
            ],
            {
              duration: 1100 + Math.random() * 400,
              easing: "cubic-bezier(.15,.8,.3,1)",
              fill: "forwards",
            },
          )
          .finished.then(() => tile.remove()),
      );
    }
  }
  return Promise.all(flights);
}

// Resolves on whichever comes first: the promise, or `ms` elapsing.
export function withTimeout(promise: Promise<unknown>, ms: number): Promise<unknown> {
  return Promise.race([promise, wait(ms)]);
}

// A bouncing instruction bubble ("Tap to whack it!"), centered at `top`.
// The bounce lives on an inner element so it doesn't fight the centering
// transform on the outer one.
export function hintBubble(layer: HTMLElement, text: string, top: number): HTMLElement {
  const outer = document.createElement("div");
  outer.className = "absolute left-1/2 -translate-x-1/2";
  outer.style.top = `${top}px`;
  // Narrow enough to stay clear of the sound button in the top corner; a
  // long hint wraps instead.
  outer.style.width = "max-content";
  outer.style.maxWidth = "calc(100vw - 144px)";
  const inner = document.createElement("div");
  inner.textContent = text;
  inner.className =
    "rounded-3xl bg-white px-4 py-2 font-bold text-pp-primary text-center leading-snug shadow-sm animate-bounce";
  outer.appendChild(inner);
  layer.appendChild(outer);
  return outer;
}

// Shrinks an on-screen element into the score counter, then removes it.
export async function flyToCounter(el: HTMLElement, counter?: { x: number; y: number }) {
  const target = counter ?? { x: window.innerWidth / 2, y: 40 };
  const r = el.getBoundingClientRect();
  const dx = target.x - (r.left + r.width / 2);
  const dy = target.y - (r.top + r.height / 2);
  const from = getComputedStyle(el).transform;
  const base = from === "none" ? "" : from;
  el.style.pointerEvents = "none";
  await el
    .animate(
      [
        { transform: `translate(0, 0) ${base}`, opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) ${base} scale(0.25)`, opacity: 0.6 },
      ],
      { duration: 450, easing: "cubic-bezier(.5,0,.8,.4)", fill: "forwards" },
    )
    .finished.catch(() => {});
  el.remove();
}

// ----- Dev panel ----------------------------------------------------------------
// For trying out a game's specials without hunting for them. Local dev
// server only: callers gate it with `process.env.NODE_ENV === "development"
// && devMode()`, which compiles away in deployed builds. Turn it on with ?dev
// on the page URL (remembered on this device; ?dev=0 turns it off).
export function devMode(): boolean {
  try {
    const q = new URLSearchParams(window.location.search).get("dev");
    if (q !== null) localStorage.setItem("pp:dev", q === "0" ? "" : "1");
    return localStorage.getItem("pp:dev") === "1";
  } catch {
    return false;
  }
}

export type DevButton = { icon: string; title?: string; run: () => string | void };

// Rows of emoji buttons on the page itself, above the score bar (which
// would swallow the taps). `run` can return a status line. Drag the ✥ handle
// to move it, tap 🛠 to fold it away; both are remembered on this device.
// Remove the returned element when the game stops.
export function devPanel(safe: { x: number; y: number }, rows: { label: string; buttons: DevButton[] }[]): HTMLElement {
  const saved = (() => {
    try {
      return JSON.parse(localStorage.getItem("pp:dev-panel") ?? "{}") as { x?: number; y?: number; folded?: boolean };
    } catch {
      return {};
    }
  })();
  const save = () => {
    try {
      localStorage.setItem("pp:dev-panel", JSON.stringify(saved));
    } catch {}
  };
  const panel = document.createElement("div");
  panel.className = "fixed z-[90] flex flex-col gap-1 rounded-2xl bg-white/90 p-2 text-xs font-bold text-pp-primary shadow-sm";
  panel.style.pointerEvents = "auto";
  panel.style.width = "max-content";
  panel.style.maxWidth = "min(260px, calc(100vw - 24px))";
  const place = (x: number, y: number) => {
    // Kept fully on screen.
    const nx = Math.max(4, Math.min(window.innerWidth - panel.offsetWidth - 4, x));
    const ny = Math.max(4, Math.min(window.innerHeight - panel.offsetHeight - 4, y));
    panel.style.left = `${nx}px`;
    panel.style.top = `${ny}px`;
    return { nx, ny };
  };

  // Header: drag handle and fold button.
  const header = document.createElement("div");
  header.className = "flex items-center gap-1";
  const handle = document.createElement("button");
  handle.type = "button";
  handle.textContent = "✥";
  handle.title = "Drag to move";
  handle.className = "h-8 w-8 rounded-full bg-pp-soft text-base cursor-move touch-none";
  const fold = document.createElement("button");
  fold.type = "button";
  fold.className = "h-8 rounded-full bg-pp-soft px-2 text-xs";
  header.append(handle, fold);
  panel.appendChild(header);

  const body = document.createElement("div");
  body.className = "flex flex-col gap-1";
  panel.appendChild(body);
  const status = document.createElement("div");
  for (const { label, buttons } of rows) {
    const wrap = document.createElement("div");
    wrap.className = "flex flex-wrap items-center gap-1";
    const title = document.createElement("span");
    title.textContent = label;
    title.className = "mr-1";
    wrap.appendChild(title);
    for (const { icon, title: tip, run } of buttons) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = icon;
      if (tip) b.title = tip;
      b.className = "h-8 min-w-8 px-1 rounded-full bg-pp-soft text-base";
      b.onclick = () => {
        const said = run();
        status.textContent = said || `${icon} done`;
      };
      wrap.appendChild(b);
    }
    body.appendChild(wrap);
  }
  status.className = "text-pp-muted";
  status.textContent = "Dev mode";
  body.appendChild(status);

  const show = () => {
    body.style.display = saved.folded ? "none" : "";
    fold.textContent = saved.folded ? "🛠 Dev" : "Hide";
  };
  fold.onclick = () => {
    saved.folded = !saved.folded;
    save();
    show();
    place(panel.offsetLeft, panel.offsetTop);
  };

  // Dragging by the handle (the game ignores presses on buttons).
  handle.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {}
    const r = panel.getBoundingClientRect();
    const dx = e.clientX - r.left;
    const dy = e.clientY - r.top;
    const move = (m: PointerEvent) => {
      const { nx, ny } = place(m.clientX - dx, m.clientY - dy);
      saved.x = nx;
      saved.y = ny;
    };
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
      save();
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  });

  document.body.appendChild(panel);
  show();
  place(saved.x ?? safe.x + 8, saved.y ?? safe.y + 8);
  return panel;
}
