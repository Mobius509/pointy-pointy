// Builds src/lib/emoji-data.json — the parent emoji picker's list — from the
// unicode-emoji-json package (a dev dependency): each emoji with its name,
// grouped, kid-friendly groups first. Leaves out emoji newer than 14.0,
// which older phones can't show, and the skin-tone/hair components.
//
//   node scripts/build-emoji-data.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const groups = JSON.parse(readFileSync(require.resolve("unicode-emoji-json/data-by-group.json"), "utf8"));
const ORDER = [
  ["food_drink", "Food & treats"],
  ["activities", "Fun & games"],
  ["animals_nature", "Animals & nature"],
  ["travel_places", "Places & trips"],
  ["objects", "Things"],
  ["smileys_emotion", "Faces"],
  ["people_body", "People"],
  ["symbols", "Symbols"],
  ["flags", "Flags"],
];
const out = ORDER.map(([slug, name]) => {
  const g = groups.find((x) => x.slug === slug);
  if (!g) throw new Error(`no group ${slug}`);
  return {
    name,
    emojis: g.emojis.filter((e) => parseFloat(e.emoji_version) <= 14).map((e) => [e.emoji, e.name]),
  };
});
writeFileSync("src/lib/emoji-data.json", JSON.stringify(out));
console.log(out.map((g) => `${g.name}: ${g.emojis.length}`).join(", "));
