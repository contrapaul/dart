import type { Level } from "../level/format";
import { getLevel, LOCAL_PREFIX } from "../editor/store";
import envOneJson from "../../data/levels/env-01.json";
import envTwoJson from "../../data/levels/env-02.json";
import envThreeJson from "../../data/levels/env-03.json";
import envFourJson from "../../data/levels/env-04.json";
import envFiveJson from "../../data/levels/env-05.json";
import fourJson from "../../data/levels/1-4.json";
import pitJson from "../../data/levels/1-1-pit.json";
import ringJson from "../../data/levels/1-4-ring.json";
import twoJson from "../../data/levels/1-2.json";
import threeJson from "../../data/levels/1-3.json";
import edOneJson from "../../data/levels/ed-01.json";

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
// GAME-10m adds env-05, the test room for the ambush from a growth: an
// F12 hidden in a foam-purple growth in env-01's room.
// ED-01 adds ed-01, the test level for the editor's prims, sky, placed
// Foamers, doors and start loadout, and `?level=local:<key>`, a level the
// player made in the editor and saved in this browser.

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
  "env-05": envFiveJson as unknown as Level,
  "ed-01": edOneJson as unknown as Level,
};

/** ED-01: the level the browser store handed over, if `?level=local:<key>`
 *  asked for one. Nothing else can see it: a page has one level at a time. */
let localLevel: { name: string; level: Level } | null = null;

/** ED-01: make a stored level the one the page plays under `name`. The page
 *  calls this after reading the store, before anything asks for the level. */
export function useLocalLevel(name: string, level: Level): void {
  localLevel = { name, level };
}

/** ED-01: `arena.html?level=local:<key>` reads the level out of the
 *  browser's store (src/editor/store.ts). Resolves to an error message for
 *  the page's status line, or null when there was nothing local to read or
 *  the level was found. */
export async function loadLocalLevel(search = location.search): Promise<string | null> {
  const name = new URLSearchParams(search).get("level");
  if (!name || !name.startsWith(LOCAL_PREFIX)) return null;
  const key = name.slice(LOCAL_PREFIX.length);
  if (!key) return `${name} names no stored level`;
  try {
    const stored = await getLevel(key);
    if (!stored) return `no stored level called ${key}`;
    useLocalLevel(name, stored.level);
    return null;
  } catch {
    // A browser that refuses the store (private mode, a blocked database)
    // is told so rather than left on a blank page.
    return "this browser will not open its level store";
  }
}

/** The level the page should play: `?level=` when it names one, else the
 *  Pit. An unknown name falls back to the Pit and `unknownLevel` says so,
 *  so the page can tell the player rather than load something else. */
export function chosenLevel(search = location.search): { level: Level; name: string; unknownLevel: string | null } {
  const name = new URLSearchParams(search).get("level");
  if (name && localLevel && localLevel.name === name) {
    return { level: localLevel.level, name, unknownLevel: null };
  }
  if (name && ARENA_LEVELS[name]) return { level: ARENA_LEVELS[name], name, unknownLevel: null };
  // LVL-05: the campaign's own level ids are the page's names ("1-1-pit").
  return { level: ARENA_LEVELS["1-1-pit"]!, name: "1-1-pit", unknownLevel: name };
}
