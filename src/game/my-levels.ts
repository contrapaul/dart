import type { Level } from "../level/format";
import { LOCAL_PREFIX, putLevel } from "../editor/store";
import type { StoredLevel } from "../editor/store";
import { validateLevel } from "../level/validate";

// ED-10a: the stored levels' list, file and URL logic, as plain functions
// with no DOM. The title menu's My levels panel used them until MENU-01
// (2026-11-29); the Levels page (src/menu/levels-page.ts) uses them now. An
// imported file is checked with the game's validator before it is stored.

export const EMPTY_TEXT = "No levels yet. Make a level first.";
export const STORE_ERROR = "This browser will not open its level store.";
export const SAVE_ERROR = "This browser will not save the level.";
export const MAX_FILE_ERRORS = 3;

export interface LevelRow {
  key: string;
  name: string;
  saved: number;
  when: string;
  playUrl: string;
  editUrl: string;
}

export interface FileCheck {
  level: Level | null;
  errors: string[];
}

/** What an imported file did: refused with errors, or stored and played. */
export interface ImportResult {
  ok: boolean;
  errors: string[];
  key?: string;
  url?: string;
}

export function playLevelUrl(key: string): string {
  return `arena.html?level=${encodeURIComponent(LOCAL_PREFIX + key)}`;
}

export function editLevelUrl(key: string): string {
  return `editor.html?open=${encodeURIComponent(key)}`;
}

export function sortNewestFirst(levels: StoredLevel[]): StoredLevel[] {
  return [...levels].sort((a, b) => b.saved - a.saved);
}

export function levelRows(levels: StoredLevel[]): LevelRow[] {
  return sortNewestFirst(levels).map((stored) => ({
    key: stored.key,
    name: stored.level.meta?.name || "[Paul]",
    saved: stored.saved,
    when: new Date(stored.saved).toLocaleString(),
    playUrl: playLevelUrl(stored.key),
    editUrl: editLevelUrl(stored.key),
  }));
}

/** The list view: rows newest first, or the empty message. */
export function levelsView(levels: StoredLevel[]): { rows: LevelRow[]; empty: string | null } {
  if (levels.length === 0) return { rows: [], empty: EMPTY_TEXT };
  return { rows: levelRows(levels), empty: null };
}

/** Parses and validates one level file. Errors are the validator's own. */
export function parseLevelFile(text: string): FileCheck {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { level: null, errors: ["Not a level file: it is not JSON."] };
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { level: null, errors: ["Not a level file."] };
  }
  const report = validateLevel(data as Level);
  if (report.errors.length) return { level: null, errors: report.errors };
  return { level: data as Level, errors: [] };
}

/** Checks a file, stores it through the given save function, then returns its URL. */
export async function storeLevelFile(
  text: string,
  save: (level: Level) => Promise<string> = putLevel,
): Promise<ImportResult> {
  const parsed = parseLevelFile(text);
  if (!parsed.level) {
    return { ok: false, errors: parsed.errors.slice(0, MAX_FILE_ERRORS) };
  }
  try {
    const key = await save(parsed.level);
    return { ok: true, errors: [], key, url: playLevelUrl(key) };
  } catch {
    return { ok: false, errors: [SAVE_ERROR] };
  }
}
