import type { Level } from "../level/format";
import type { StoredLevel } from "../editor/store";
import { validateLevel } from "../level/validate";
import { editLevelUrl, playLevelUrl, sortNewestFirst } from "../game/my-levels";

// MENU-01 (2026-11-29): what the Levels page lists. Shipped levels (the
// files in data/levels/, none yet) come first, then the levels made in the
// Map Builder on this browser, newest first. No DOM here, so it is tested
// headless; src/menu/levels-page.ts draws it.

export const NO_AUTHOR = "[Paul]";

export interface LevelEntry {
  /** Unique on the page: "shipped:<file>" or "local:<key>". */
  id: string;
  source: "shipped" | "local";
  name: string;
  author: string;
  /** A data: URL, or null when the level has no picture (shipped levels,
   *  and Map Builder levels saved before pictures were taken). */
  picture: string | null;
  /** Label and value pairs for the details list. */
  facts: [string, string][];
  /** The validator's errors: a level with any cannot be played. */
  errors: string[];
  playUrl: string;
  /** Map Builder levels only: opens the level itself, not a copy. */
  editUrl: string | null;
}

function minutes(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function levelFacts(level: Level): [string, string][] {
  const facts: [string, string][] = [
    ["Foamers placed", String(level.foamers?.length ?? 0)],
    ["Pickups", String(level.pickups?.length ?? 0)],
    ["Target time", minutes(level.meta.targetSeconds ?? 0)],
  ];
  if (level.meta.setting) facts.push(["Setting", level.meta.setting]);
  return facts;
}

export function levelEntries(shipped: Record<string, Level>, stored: StoredLevel[]): LevelEntry[] {
  const own = (level: Level) => ({
    name: level.meta?.name || "[Paul]",
    author: level.meta?.author || NO_AUTHOR,
    errors: validateLevel(level).errors,
  });
  const fromFiles = Object.keys(shipped).sort().map((file): LevelEntry => ({
    id: `shipped:${file}`,
    source: "shipped",
    ...own(shipped[file]!),
    picture: null,
    facts: levelFacts(shipped[file]!),
    playUrl: `arena.html?level=${encodeURIComponent(file)}`,
    editUrl: null,
  }));
  const fromStore = sortNewestFirst(stored).map((s): LevelEntry => ({
    id: `local:${s.key}`,
    source: "local",
    ...own(s.level),
    picture: s.picture ?? null,
    facts: [...levelFacts(s.level), ["Saved", new Date(s.saved).toLocaleString()]],
    playUrl: playLevelUrl(s.key),
    editUrl: editLevelUrl(s.key),
  }));
  return [...fromFiles, ...fromStore];
}
