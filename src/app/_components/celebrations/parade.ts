import { imageEl, makeLayer, type CelebrationOptions } from "./shared";
import { playSound } from "./sounds";

// Everything the parade might hold up. Shuffled each time.
const SIGNS = [
  "Yay!", "Woo!", "Go!", "Wow!", "Yes!", "Boom!", "Nice!", "Epic!",
  "Whee!", "Hooray!", "Legend!", "Party!", "Go go go!", "So cool!",
  "Let's go!", "Amazing!", "Superstar!", "You rock!", "High five!",
  "Big win!", "Nailed it!", "Level up!", "Cha-ching!", "Heck yes!",
  "Ta-da!", "Bravo!", "Zoom!", "Wheee!", "OMG!", "LOL!", "10/10",
  "🎉", "⭐", "🔥", "🙌", "💪", "🏆", "🚀", "🎈", "🍭", "🦄", "💯",
  "🎉🎉", "⭐⭐⭐", "🔥🔥", "👏👏", "😎", "🥳", "🤩", "💖",
];

// A conga line of mini avatars hops across the screen, each holding up a
// sign — the points, and a random mix of cheers.
export async function playParade(opts: CelebrationOptions): Promise<void> {
  const layer = makeLayer();
  const W = window.innerWidth;
  const H = window.innerHeight;
  const size = Math.min(W * 0.2, 84);
  const count = W < 480 ? 6 : 8;
  const points = opts.points ?? 0;
  // A different mix of signs every parade.
  const pool = [...SIGNS].sort(() => Math.random() - 0.5);
  const signs = points ? [`+${points}`, ...pool.slice(0, 3), `+${points}`, ...pool.slice(3)] : pool;
  // March along the tapped height in the replay game.
  const baseline = Math.min(H - 20, Math.max(size * 2, opts.at?.y ?? H * 0.66));
  const DURATION = 4200;
  const STAGGER = 260;

  void playSound("cheer");
  const walks: Promise<unknown>[] = [];

  for (let i = 0; i < count; i++) {
    const walker = document.createElement("div");
    walker.className = "absolute flex flex-col items-center";
    Object.assign(walker.style, { left: "0", top: `${baseline - size}px`, width: `${size}px` });

    const sign = document.createElement("div");
    sign.textContent = signs[i % signs.length];
    sign.className =
      "mb-1 rounded-lg bg-white px-2 py-0.5 text-sm font-black text-pp-primary shadow-sm whitespace-nowrap";
    const avatar = imageEl(opts.avatarSrc, "select-none");
    Object.assign(avatar.style, { width: `${size}px`, height: `${size}px` });
    walker.append(sign, avatar);
    layer.appendChild(walker);

    // March left → right…
    walks.push(
      walker.animate(
        [{ transform: `translateX(${-size * 1.5}px)` }, { transform: `translateX(${W + size * 0.5}px)` }],
        { duration: DURATION, delay: i * STAGGER, easing: "linear", fill: "both" },
      ).finished,
    );
    // …hopping and wiggling the whole way, sign bobbing a beat behind.
    const hop = 330 + Math.random() * 60;
    avatar.animate(
      [
        { transform: "translateY(0) rotate(-6deg)" },
        { transform: "translateY(-22px) rotate(6deg)", offset: 0.5 },
        { transform: "translateY(0) rotate(-6deg)" },
      ],
      { duration: hop, iterations: Infinity, easing: "ease-in-out" },
    );
    sign.animate(
      [{ transform: "translateY(0) rotate(4deg)" }, { transform: "translateY(-14px) rotate(-4deg)" }, { transform: "translateY(0) rotate(4deg)" }],
      { duration: hop, delay: 80, iterations: Infinity, easing: "ease-in-out" },
    );
  }

  await Promise.all(walks);
  layer.remove();
}
