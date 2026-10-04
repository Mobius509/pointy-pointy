// The mini games (vs. celebrations that just play). These can be played in
// "Keep playing" after a celebration, keep family high scores, and are what
// a streak's arcade ticket unlocks. Plain data so server code can use it;
// the celebrations registry checks its "score" games match this list.
export const ARCADE_GAMES = [
  { id: "pinata", name: "Piñata", icon: "🪅" },
  { id: "balloons", name: "Balloon pop", icon: "🎈" },
  { id: "worm", name: "Worm", icon: "🐛" },
  { id: "chomper", name: "Chomper", icon: "😋" },
  { id: "mole", name: "Whack-a-mole", icon: "🔨" },
  { id: "asteroids", name: "Asteroids", icon: "☄️" },
  { id: "flappy", name: "Flappy bird", icon: "🐦" },
  { id: "stack", name: "Block stack", icon: "🧱" },
  { id: "marble", name: "Marble tilt", icon: "🔮" },
  { id: "claw", name: "Claw machine", icon: "🎁" },
  { id: "bubbles", name: "Bubble shooter", icon: "🫧" },
  { id: "pong", name: "Pong", icon: "🏓" },
  { id: "doodle", name: "Sky jump", icon: "🦘" },
  { id: "fall", name: "Free fall", icon: "🪂" },
] as const;

export type ArcadeGameId = (typeof ARCADE_GAMES)[number]["id"];

export const isArcadeGame = (id: string): id is ArcadeGameId => ARCADE_GAMES.some((g) => g.id === id);
export const arcadeGameName = (id: string) => ARCADE_GAMES.find((g) => g.id === id)?.name ?? id;

// The 3D icon for a game (public/games/<id>.webp, made from the exported
// art in public/icons/3dIcon_*.png). Games without one yet use their emoji.
// The iOS app has the same set in its asset catalog (Game3D-<id>).
export const GAMES_WITH_ART: readonly ArcadeGameId[] = ["pinata", "worm", "chomper", "mole", "asteroids", "flappy", "stack"];
export const arcadeGameArt = (id: string): string | null =>
  (GAMES_WITH_ART as readonly string[]).includes(id) ? `/games/${id}.webp` : null;
export const arcadeGameIcon = (id: string) => ARCADE_GAMES.find((g) => g.id === id)?.icon ?? "🎮";
