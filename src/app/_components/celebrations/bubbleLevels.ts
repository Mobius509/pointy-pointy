// Bubble shooter rounds: how hard each one is, which special bubbles it
// brings in, and the board shapes. Tune the numbers here.

export type SpecialKind =
  | "pearl" // colored; clearing it earns a power shot
  | "rainbow" // matches any color
  | "stone" // never pops — only drops
  | "prize" // colored; bonus points when cleared
  | "skull" // risky: hit it (or pop next to it) and it spawns bubbles
  | "star" // a shot touching it pops every bubble of the shot's color
  | "ice" // colored; the first match cracks it, the next pops it
  | "bomb" // blasts the bubbles around it
  | "ghost" // risky like the skull, but blinks — shots pass through when it's gone
  | "lightning" // clears its row
  | "chained"; // colored, but stuck like stone until a neighbour pops

// The order they turn up in: round n brings in UNLOCK_ORDER[n − 1].
export const UNLOCK_ORDER: SpecialKind[] = [
  "pearl",
  "rainbow",
  "stone",
  "prize",
  "skull",
  "star",
  "ice",
  "bomb",
  "ghost",
  "lightning",
  "chained",
];

export const SPECIAL_INFO: Record<SpecialKind, { icon: string; hint: string }> = {
  pearl: { icon: "✨", hint: "Pop a shiny pearl to win a power shot!" },
  rainbow: { icon: "🌈", hint: "New: 🌈 Rainbow — matches any color!" },
  stone: { icon: "🪨", hint: "New: 🪨 Stone — can't pop, but it drops!" },
  prize: { icon: "🎁", hint: "New: 🎁 Prize — clear it for +5!" },
  skull: { icon: "💀", hint: "Careful: 💀 Skull — touch it and more bubbles appear!" },
  star: { icon: "⭐", hint: "New: ⭐ Star — hit it to pop every bubble of your color!" },
  ice: { icon: "🧊", hint: "New: 🧊 Ice — takes two matches to pop!" },
  bomb: { icon: "💣", hint: "New: 💣 Bomb — blasts everything around it!" },
  ghost: { icon: "👻", hint: "Careful: 👻 Ghost — it blinks, and adds bubbles when it's there!" },
  lightning: { icon: "⚡", hint: "New: ⚡ Lightning — clears its whole row!" },
  chained: { icon: "🔒", hint: "New: 🔒 Chained — pop a bubble next to it to free it!" },
};

export type RoundSpec = {
  colors: number;
  misses: number; // shots that don't pop anything before a row pushes down
  aim: number; // how much of the aim line shows (1 = all of it)
  unlocked: SpecialKind[];
  introduces: SpecialKind | null; // new this round
  specials: number; // how many non-pearl specials on the board
  pearls: number;
};

export function roundSpec(round: number): RoundSpec {
  const n = Math.max(1, round);
  const unlocked = UNLOCK_ORDER.slice(0, Math.min(n, UNLOCK_ORDER.length));
  return {
    colors: n <= 2 ? 3 : n <= 5 ? 4 : 5,
    misses: n <= 2 ? 8 : n <= 4 ? 7 : n <= 7 ? 6 : 5,
    aim: n <= 2 ? 1 : n <= 5 ? 0.6 : 0.4,
    unlocked,
    introduces: n <= UNLOCK_ORDER.length ? UNLOCK_ORDER[n - 1] : null,
    specials: unlocked.length > 1 ? Math.min(1 + Math.floor(n / 2), 7) : 0,
    pearls: n >= 4 ? 2 : 1,
  };
}

// Board shapes on the honeycomb: rows alternate 8 and 7 bubbles (the
// short rows sit half a bubble in). "#" = a bubble. Anything not hanging
// from the top row is trimmed when the board is built, so a shape can't
// start with loose bubbles.
export const SHAPES: string[][] = [
  // Full block
  ["########", "#######", "########", "#######", "########"],
  // Funnel
  ["########", "#######", ".######.", ".#####.", "..####..", "..###..", "...##..."],
  // Heart
  [".##..##.", "###.###", "########", "#######", ".######.", ".#####.", "..####..", "..###..", "...##..."],
  // Smiley
  ["########", "#.###.#", "########", "#######", "#.####.#", "##...##", ".######."],
  // Diamond
  ["...##...", "..###..", ".######.", "#######", ".######.", "..###..", "...##..."],
  // Curtains
  ["########", "#######", "###..###", "##...##", "##....##", "#.....#", "#......#"],
  // Chandelier
  ["########", ".#.##.#", ".##..##.", ".#.##.#", ".##..##.", "..#..#.", "..#..#.."],
  // Steps
  ["########", "######.", "######..", "####...", "####....", "##.....", "##......"],
];
