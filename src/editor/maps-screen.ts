import type { Level } from "../level/format";
import type { StoredLevel } from "./store";

// R3-10: the Maps screen, a dialog opened by the top bar's Open button.
// It lists the maps being worked on (saved ones, newest first, then the
// built-ins opened as copies), with a search box. The view over the data is
// pure and tested; the dialog renders it.

export interface MapRow {
  kind: "saved" | "builtIn";
  /** The store key (saved rows only). */
  key: string | null;
  /** The level file's path (built-in rows only). */
  path: string | null;
  name: string;
  /** Milliseconds since 1970 (saved rows only). */
  when: number | null;
  current: boolean;
  /** A data: URL of the level, or null. */
  picture: string | null;
}

export function builtInName(path: string): string {
  return path.split("/").pop()?.replace(/\.json$/, "") ?? path;
}

/** The rows of the screen: saved levels newest first, then the built-ins. */
export function mapsView(stored: StoredLevel[], builtIns: { path: string }[], currentKey: string | null): MapRow[] {
  const saved: MapRow[] = stored.map((s) => ({
    kind: "saved",
    key: s.key,
    path: null,
    name: s.level.meta.name || "[Paul]",
    when: s.saved,
    current: s.key === currentKey,
    picture: s.picture ?? null,
  }));
  const builtins: MapRow[] = builtIns.map((b) => ({
    kind: "builtIn",
    key: null,
    path: b.path,
    name: builtInName(b.path),
    when: null,
    current: false,
    picture: null,
  }));
  return [...saved, ...builtins];
}

/** Rows whose name contains `query` (case-insensitive); all rows when empty. */
export function filterRows(rows: MapRow[], query: string): MapRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => r.name.toLowerCase().includes(q));
}

export interface MapsDialogHost {
  currentKey(): string | null;
  /** The status text shown for the open map. */
  currentState(): string;
  stored(): Promise<StoredLevel[]>;
  builtIns(): { path: string }[];
  openStored(key: string): void;
  duplicateStored(key: string): void;
  exportStored(level: Level): void;
  deleteStored(key: string): void;
  openBuiltIn(path: string): void;
  newMap(): void;
}

function button(text: string, act: () => void): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.textContent = text;
  el.addEventListener("click", act);
  return el;
}

export function buildMapsScreen(body: HTMLElement, host: MapsDialogHost): void {
  const search = document.createElement("input");
  search.type = "search";
  search.className = "map-search";
  search.placeholder = "Search maps by name";
  search.maxLength = 60;

  const state = document.createElement("p");
  state.className = "hint maps-state";

  const grid = document.createElement("div");
  grid.className = "map-grid";

  const render = (rows: MapRow[]) => {
    const shown = filterRows(rows, search.value);
    grid.replaceChildren();
    const newCard = document.createElement("button");
    newCard.type = "button";
    newCard.className = "map-card map-new";
    newCard.textContent = "+ New map";
    newCard.addEventListener("click", () => host.newMap());
    grid.append(newCard);
    for (const row of shown) grid.append(card(row, host));
    if (!shown.length) {
      const empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = "No maps match that name.";
      grid.append(empty);
    }
  };

  const refresh = async () => {
    const stored = await host.stored();
    const stateText = host.currentState();
    state.textContent = `Open map: ${stateText}`;
    render(mapsView(stored, host.builtIns(), host.currentKey()));
  };

  search.addEventListener("input", () => void refresh());
  body.append(search, state, grid);
  void refresh();
}

function card(row: MapRow, host: MapsDialogHost): HTMLElement {
  const el = document.createElement("div");
  el.className = "map-card";
  const img = document.createElement("img");
  img.className = "map-pic";
  img.alt = row.name;
  if (row.picture) img.src = row.picture;
  else { img.hidden = true; }
  const title = document.createElement("p");
  title.className = "map-name";
  title.textContent = row.name;
  const meta = document.createElement("p");
  meta.className = "map-meta";
  meta.textContent = row.kind === "saved"
    ? (row.when ? new Date(row.when).toLocaleString() : "")
    : "Built in, opens as a copy";
  el.append(img, title, meta);
  if (row.current) {
    const mark = document.createElement("p");
    mark.className = "map-current";
    mark.textContent = "Current";
    el.append(mark);
  }
  const rowButtons = document.createElement("div");
  rowButtons.className = "row";
  if (row.kind === "saved" && row.key) {
    rowButtons.append(
      button("Open", () => host.openStored(row.key!)),
      button("Duplicate", () => host.duplicateStored(row.key!)),
      button("Export", () => {
        void host.stored().then((stored) => {
          const found = stored.find((s) => s.key === row.key);
          if (found) host.exportStored(found.level);
        });
      }),
    );
    if (!row.current) {
      rowButtons.append(button("Delete", () => {
        if (window.confirm(`Delete "${row.name}"? This cannot be undone.`)) host.deleteStored(row.key!);
      }));
    }
  } else if (row.path) {
    rowButtons.append(button("Open", () => host.openBuiltIn(row.path!)));
  }
  el.append(rowButtons);
  return el;
}
