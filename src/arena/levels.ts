import type { Level } from "../level/format";
import envOneJson from "../../data/levels/env-01.json";
import envTwoJson from "../../data/levels/env-02.json";
import envThreeJson from "../../data/levels/env-03.json";
import envFourJson from "../../data/levels/env-04.json";
import fourJson from "../../data/levels/1-4.json";
import pitJson from "../../data/levels/1-1-pit.json";
import ringJson from "../../data/levels/1-4-ring.json";
import twoJson from "../../data/levels/1-2.json";
import threeJson from "../../data/levels/1-3.json";

// GAME-10b: the arena page's level choice. `arena.html?level=1-4-ring` loads
// the Ring; anything else, or nothing, loads the Pit (the card: the Pit
// stays the default). Level files are imported by name rather than fetched,
// because nothing is ever fetched from another host and Vite has to bundle
// them anyway. Both src/arena/main.ts and src/arena/extras.ts read the
// level through here, so the built level and the arena extras agree.
// LVL-02b adds 1-2 (beats 1 to 4), the level with two arenas in order.
// LVL-03a adds 1-3 (beats 1 to 5), the Swarmer's level.
// LVL-04a adds 1-4 (beats 1 to 5), the Darter's level up to the bridge.
// ENV-01 adds env-01, the test room for foam cladding: one room, no arena.
// ENV-02 adds env-02, the test level for the toy button: two rooms, one
// door that only a button opens.
// ENV-03 adds env-03, the test room for the mod stations: the same room.

/** Every level the arena page can play, keyed by its file name. */
export const ARENA_LEVELS: Record<string, Level> = {
  "1-1-pit": pitJson as unknown as Level,
  "1-2": twoJson as unknown as Level,
  "1-3": threeJson as unknown as Level,
  "1-4": fourJson as unknown as Level,
  "1-4-ring": ringJson as unknown as Level,
  "env-01": envOneJson as unknown as Level,
  "env-02": envTwoJson as unknown as Level,
  "env-03": envThreeJson as unknown as Level,
  "env-04": envFourJson as unknown as Level,
};

/** The level the page should play: `?level=` when it names one, else the
 *  Pit. An unknown name falls back to the Pit and `unknownLevel` says so,
 *  so the page can tell the player rather than load something else. */
export function chosenLevel(search = location.search): { level: Level; unknownLevel: string | null } {
  const name = new URLSearchParams(search).get("level");
  if (name && ARENA_LEVELS[name]) return { level: ARENA_LEVELS[name], unknownLevel: null };
  return { level: ARENA_LEVELS["1-1-pit"]!, unknownLevel: name };
}
