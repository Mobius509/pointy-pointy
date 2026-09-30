import { EFFECT_Z, wait, type CelebrationOptions } from "./shared";

const GRID = 6;

// The avatar winds up (wobble + puff), bursts into a 6×6 grid of tiles
// that fly off spinning, "POP!" flashes, then the avatar pops back in.
export async function playAvatarExplosion(opts: CelebrationOptions): Promise<void> {
  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.className = "pointer-events-none fixed inset-0 overflow-hidden";
  layer.style.zIndex = String(EFFECT_Z);
  document.body.appendChild(layer);

  // Where the avatar lives on screen (or a big one in the middle).
  const size = opts.origin ? opts.origin.getBoundingClientRect().width : 180;
  const rect = opts.origin?.getBoundingClientRect() ?? {
    left: (window.innerWidth - size) / 2,
    top: (window.innerHeight - size) / 2,
    width: size,
    height: size,
  };

  // Hide the real avatar and wind up a stand-in copy over it.
  if (opts.origin) opts.origin.style.visibility = "hidden";
  const stand = document.createElement("img");
  stand.src = opts.avatarSrc;
  stand.alt = "";
  stand.className = "absolute object-contain animate-celebrate-wobble";
  Object.assign(stand.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
  layer.appendChild(stand);
  await wait(900);

  // Burst: tiles start where the puffed-up avatar is (scaled 1.45).
  const scale = 1.45;
  const w = rect.width * scale;
  const h = rect.height * scale;
  const x0 = rect.left - (w - rect.width) / 2;
  const y0 = rect.top - (h - rect.height) / 2;
  const tw = w / GRID;
  const th = h / GRID;
  stand.remove();

  const flights: Promise<unknown>[] = [];
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const tile = document.createElement("div");
      tile.className = "absolute";
      Object.assign(tile.style, {
        left: `${x0 + col * tw}px`,
        top: `${y0 + row * th}px`,
        width: `${tw}px`,
        height: `${th}px`,
        backgroundImage: `url("${opts.avatarSrc}")`,
        backgroundSize: `${w}px ${h}px`,
        backgroundPosition: `${-col * tw}px ${-row * th}px`,
      });
      layer.appendChild(tile);

      // Fly away from the avatar's center, a little randomized.
      const dx = col - (GRID - 1) / 2 + (Math.random() - 0.5);
      const dy = row - (GRID - 1) / 2 + (Math.random() - 0.5);
      const len = Math.hypot(dx, dy) || 1;
      const dist = 250 + Math.random() * 450;
      const tx = (dx / len) * dist;
      const ty = (dy / len) * dist + 120; // a bit of gravity
      const spin = (Math.random() - 0.5) * 900;
      flights.push(
        tile.animate(
          [
            { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
            { opacity: 1, offset: 0.6 },
            { transform: `translate(${tx}px, ${ty}px) rotate(${spin}deg)`, opacity: 0 },
          ],
          { duration: 1100 + Math.random() * 400, easing: "cubic-bezier(.15,.8,.3,1)", fill: "forwards" },
        ).finished,
      );
    }
  }

  // "POP!"
  const pop = document.createElement("div");
  pop.textContent = "POP!";
  pop.className = "absolute font-black text-pp-primary animate-celebrate-pop-in";
  Object.assign(pop.style, {
    left: `${rect.left + rect.width / 2}px`,
    top: `${rect.top + rect.height / 2}px`,
    translate: "-50% -50%",
    fontSize: "64px",
  });
  layer.appendChild(pop);
  pop.animate([{ opacity: 1 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }], {
    duration: 1100,
    fill: "forwards",
  });

  await Promise.all(flights);

  // Bring the real avatar back with a bounce.
  if (opts.origin) {
    opts.origin.style.visibility = "";
    opts.origin.classList.remove("animate-celebrate-pop-in");
    void opts.origin.offsetWidth; // restart the animation
    opts.origin.classList.add("animate-celebrate-pop-in");
  }
  layer.remove();
}
