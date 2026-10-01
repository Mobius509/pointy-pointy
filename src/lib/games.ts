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
] as const;

export type ArcadeGameId = (typeof ARCADE_GAMES)[number]["id"];

export const isArcadeGame = (id: string): id is ArcadeGameId => ARCADE_GAMES.some((g) => g.id === id);
export const arcadeGameName = (id: string) => ARCADE_GAMES.find((g) => g.id === id)?.name ?? id;
