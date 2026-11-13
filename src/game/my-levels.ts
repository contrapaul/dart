import type { Level } from "../level/format";
import { LOCAL_PREFIX, listLevels, putLevel } from "../editor/store";
import type { StoredLevel } from "../editor/store";
import { validateLevel } from "../level/validate";

// ED-10a: the title menu's My levels panel. It reads the browser store, lists
// stored levels newest first, and opens either the arena or the editor. An
// imported file is checked with the game's validator before it is stored.
// The editor's `?open=<key>` parameter is wired by another card.
//
// The list, file and URL logic are plain functions: no DOM, so they can be
// tested without a browser. `wireMyLevels` is the only DOM part.

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

export function wireMyLevels(root: ParentNode = document): void {
  const panel = root.querySelector<HTMLDivElement>("#myLevels");
  const list = root.querySelector<HTMLDivElement>("#myLevelsList");
  const empty = root.querySelector<HTMLParagraphElement>("#myLevelsEmpty");
  const error = root.querySelector<HTMLParagraphElement>("#myLevelsError");
  const problems = root.querySelector<HTMLDivElement>("#myLevelsProblems");
  const fileInput = root.querySelector<HTMLInputElement>("#myLevelFile");
  const openFile = root.querySelector<HTMLButtonElement>("#openLevelFile");
  const playLevel = root.querySelector<HTMLButtonElement>("#playLevel");
  const back = root.querySelector<HTMLButtonElement>("#myLevelsBack");

  if (!panel || !list) return;
  const levelsList = list;

  const close = () => {
    panel.hidden = true;
  };

  const open = () => {
    panel.hidden = false;
    void refresh();
  };

  playLevel?.addEventListener("click", open);
  back?.addEventListener("click", close);
  (root as Document).addEventListener("keydown", (event) => {
    if ((event as KeyboardEvent).key === "Escape" && !panel.hidden) close();
  });

  function button(label: string, on: () => void): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", on);
    return b;
  }

  function showProblems(errors: string[]): void {
    if (!problems) return;
    problems.replaceChildren();
    for (const message of errors.slice(0, MAX_FILE_ERRORS)) {
      const line = document.createElement("div");
      line.textContent = message;
      problems.append(line);
    }
    problems.hidden = false;
  }

  function render(levels: StoredLevel[]): void {
    levelsList.replaceChildren();
    error!.hidden = true;
    const view = levelsView(levels);
    if (view.empty) {
      empty!.textContent = view.empty;
      empty!.hidden = false;
      return;
    }
    empty!.hidden = true;
    for (const row of view.rows) {
      const line = document.createElement("div");
      line.className = "level-row";

      const name = document.createElement("span");
      name.className = "name";
      name.textContent = row.name;

      const when = document.createElement("span");
      when.className = "when";
      when.textContent = row.when;

      const actions = document.createElement("span");
      actions.className = "actions";
      actions.append(
        button("Play", () => {
          location.href = row.playUrl;
        }),
        button("Edit", () => {
          location.href = row.editUrl;
        }),
      );

      line.append(name, when, actions);
      levelsList.append(line);
    }
  }

  async function refresh(): Promise<void> {
    levelsList.replaceChildren();
    empty!.hidden = true;
    error!.hidden = true;
    let levels: StoredLevel[];
    try {
      levels = await listLevels();
    } catch {
      error!.textContent = STORE_ERROR;
      error!.hidden = false;
      return;
    }
    render(levels);
  }

  async function importFile(file: File): Promise<void> {
    problems!.hidden = true;
    error!.hidden = true;
    const result = await storeLevelFile(await file.text());
    if (!result.ok) {
      if (result.errors.length === 1 && result.errors[0] === SAVE_ERROR) {
        error!.textContent = SAVE_ERROR;
        error!.hidden = false;
      } else {
        showProblems(result.errors);
      }
      return;
    }
    location.href = result.url!;
  }

  openFile?.addEventListener("click", () => fileInput?.click());
  fileInput?.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (file) void importFile(file);
  });
}
