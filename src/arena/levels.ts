import type { Level } from "../level/format";
import { getLevel, LOCAL_PREFIX } from "../editor/store";

// GAME-10b: the arena page's level choice. `arena.html?level=<name>` plays
// a shipped level from data/levels/ (bundled, never fetched); ED-01 added
// `?level=local:<key>`, a level the player made in the Map Builder and
// saved in this browser. Both src/arena/main.ts and src/arena/extras.ts
// read the level through here, so the built level and the arena extras
// agree. MENU-01 (2026-11-29): the old test levels left the game (they are
// test fixtures now, in tests/fixtures/levels/), so there is no default
// level: a page with no level, or an unknown one, says so and offers the
// Levels page.

const FILES = import.meta.glob<{ default: unknown }>("../../data/levels/*.json", { eager: true });

/** Every shipped level the arena page can play, keyed by its file name. */
export const ARENA_LEVELS: Record<string, Level> = Object.fromEntries(
  Object.entries(FILES).map(([path, mod]) => [path.split("/").pop()!.replace(/\.json$/, ""), mod.default as Level]),
);

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

/** The level the page should play, or null when `?level=` names none the
 *  page has (the page then says so instead of loading something else). */
export function chosenLevel(search = location.search): { level: Level; name: string } | null {
  const name = new URLSearchParams(search).get("level");
  if (!name) return null;
  if (localLevel && localLevel.name === name) return { level: localLevel.level, name };
  const shipped = ARENA_LEVELS[name];
  return shipped ? { level: shipped, name } : null;
}
