import type { Level } from "../level/format";
import pitJson from "../../data/levels/1-1-pit.json";
import ringJson from "../../data/levels/1-4-ring.json";

// GAME-10b: the arena page's level choice. `arena.html?level=1-4-ring` loads
// the Ring; anything else, or nothing, loads the Pit (the card: the Pit
// stays the default). Level files are imported by name rather than fetched,
// because nothing is ever fetched from another host and Vite has to bundle
// them anyway. Both src/arena/main.ts and src/arena/extras.ts read the
// level through here, so the built level and the arena extras agree.

/** Every level the arena page can play, keyed by its file name. */
export const ARENA_LEVELS: Record<string, Level> = {
  "1-1-pit": pitJson as unknown as Level,
  "1-4-ring": ringJson as unknown as Level,
};

/** The level the page should play: `?level=` when it names one, else the
 *  Pit. An unknown name falls back to the Pit and `unknownLevel` says so,
 *  so the page can tell the player rather than load something else. */
export function chosenLevel(search = location.search): { level: Level; unknownLevel: string | null } {
  const name = new URLSearchParams(search).get("level");
  if (name && ARENA_LEVELS[name]) return { level: ARENA_LEVELS[name], unknownLevel: null };
  return { level: ARENA_LEVELS["1-1-pit"]!, unknownLevel: name };
}
