import {
  explodeImage,
  makeLayer,
  slamWord,
  wait,
  type CelebrationOptions,
} from "./shared";
import { playSound } from "./sounds";

// The avatar winds up (wobble + puff), bursts into a 6×6 grid of tiles
// that fly off spinning, "POP!" flashes, then the avatar pops back in.
export async function playAvatarExplosion(opts: CelebrationOptions): Promise<void> {
  const layer = makeLayer();

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
  stand.remove();
  void playSound("pop");
  setTimeout(() => void playSound("cheer"), 250);
  const flights = explodeImage(layer, opts.avatarSrc, {
    left: rect.left - (w - rect.width) / 2,
    top: rect.top - (h - rect.height) / 2,
    width: w,
    height: h,
  });
  slamWord(layer, "POP!", rect.left + rect.width / 2, rect.top + rect.height / 2, {
    duration: 1100,
    tilt: 0,
  });
  await flights;

  // Bring the real avatar back with a bounce.
  if (opts.origin) {
    opts.origin.style.visibility = "";
    opts.origin.classList.remove("animate-celebrate-pop-in");
    void opts.origin.offsetWidth; // restart the animation
    opts.origin.classList.add("animate-celebrate-pop-in");
  }
  layer.remove();
}
