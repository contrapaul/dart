// ED-30 item 1: the outliner groups fold. The folded state lives in a module
// level Set so a redraw of the outliner does not lose it, and in localStorage
// under "dart-editor-folded" so it survives a reload. Every storage read and
// write is wrapped in try/catch: a browser that blocks localStorage must
// still work, just without the remembered folds.

export const FOLDED_KEY = "dart-editor-folded";

const folded = new Set<string>();

function storage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

function load() {
  const s = storage();
  if (!s) return;
  try {
    const raw = s.getItem(FOLDED_KEY);
    if (!raw) return;
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return;
    for (const v of arr) if (typeof v === "string") folded.add(v);
  } catch {
    // A broken or hand edited value is ignored, not fatal.
  }
}

function save() {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(FOLDED_KEY, JSON.stringify([...folded]));
  } catch {
    // Storage full or blocked: the folds still work for this session.
  }
}

load();

export function isFolded(title: string): boolean {
  return folded.has(title);
}

export function foldedGroups(): readonly string[] {
  return [...folded];
}

export function setFolded(title: string, on: boolean): void {
  const had = folded.has(title);
  if (on === had) return;
  if (on) folded.add(title);
  else folded.delete(title);
  save();
}

export function toggleFolded(title: string): boolean {
  const on = !folded.has(title);
  setFolded(title, on);
  return on;
}

/** Selecting a thing in the view unfolds its group, so the selected row is
 *  seen even in a folded list (Paul, ED-30). */
export function unfoldGroup(title: string): void {
  setFolded(title, false);
}

/** Re-reads the stored folds into the set. A test calls this after a fake
 *  storage is installed. */
export function reloadFolded(): void {
  folded.clear();
  load();
}
