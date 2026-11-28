// MENU-01 (2026-11-29): the Levels page. The list on the left third, the
// chosen level on the right: its picture, name, author and details, with
// Play and, for a level made here, Open in Map Builder. The list logic is
// src/menu/level-list.ts.
import { listLevels } from "../editor/store";
import { ARENA_LEVELS } from "../arena/levels";
import { STORE_ERROR, storeLevelFile } from "../game/my-levels";
import { levelEntries, type LevelEntry } from "./level-list";
import { wireMenuKeys } from "./title";

const list = document.querySelector<HTMLElement>("#levelList")!;
const detail = document.querySelector<HTMLElement>("#levelDetail")!;
const fileInput = document.querySelector<HTMLInputElement>("#levelFile")!;
const fileProblems = document.querySelector<HTMLParagraphElement>("#fileProblems")!;

wireMenuKeys(list, false);

let entries: LevelEntry[] = [];
let chosen: string | null = null;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function drawList(storeError: string | null): void {
  list.replaceChildren();
  const groups: [string, LevelEntry[], string][] = [
    ["Shipped", entries.filter((e) => e.source === "shipped"), "None ship yet."],
    ["Made here", entries.filter((e) => e.source === "local"), storeError ?? "None yet. Make one in the Map Builder."],
  ];
  for (const [title, items, none] of groups) {
    list.append(el("h3", undefined, title));
    if (items.length === 0) list.append(el("p", "empty", none));
    for (const entry of items) {
      const b = el("button", "menu-item", entry.name);
      b.type = "button";
      b.dataset.id = entry.id;
      b.title = entry.name;
      b.setAttribute("aria-current", String(entry.id === chosen));
      b.addEventListener("click", () => choose(entry.id));
      b.addEventListener("focus", () => choose(entry.id));
      list.append(b);
    }
  }
}

function drawDetail(): void {
  detail.replaceChildren();
  const entry = entries.find((e) => e.id === chosen);
  if (!entry) {
    detail.append(el("p", "empty", "Choose a level from the list."));
    return;
  }
  if (entry.picture) {
    const img = el("img", "level-picture");
    img.src = entry.picture;
    img.alt = `A picture of ${entry.name}`;
    detail.append(img);
  } else {
    detail.append(el("div", "level-picture", entry.source === "local"
      ? "No picture yet: save the level in the Map Builder to take one."
      : "No picture yet."));
  }
  detail.append(el("h3", undefined, entry.name));
  const facts = el("dl", "level-facts");
  for (const [label, value] of [["Author", entry.author], ...entry.facts] as [string, string][]) {
    facts.append(el("dt", undefined, label), el("dd", value === "[Paul]" ? "placeholder" : undefined, value));
  }
  if (entry.errors.length) {
    facts.append(el("dt", undefined, "Problems"), el("dd", "bad", entry.errors.slice(0, 3).join("; ")));
  }
  detail.append(facts);

  const actions = el("div", "level-actions");
  const play = el("a", "retro-button play", "Play");
  if (entry.errors.length) {
    play.setAttribute("aria-disabled", "true");
    play.title = "This level has errors: open it in the Map Builder to fix them.";
  } else {
    play.href = entry.playUrl;
  }
  actions.append(play);
  if (entry.editUrl) {
    const edit = el("a", "retro-button", "Open in Map Builder");
    edit.href = entry.editUrl;
    actions.append(edit);
  }
  detail.append(actions);
}

function choose(id: string): void {
  if (chosen === id) return;
  chosen = id;
  for (const b of list.querySelectorAll<HTMLElement>(".menu-item")) {
    b.setAttribute("aria-current", String(b.dataset.id === id));
  }
  drawDetail();
}

async function refresh(pick?: string): Promise<void> {
  let stored: Awaited<ReturnType<typeof listLevels>> = [];
  let storeError: string | null = null;
  try {
    stored = await listLevels();
  } catch {
    storeError = STORE_ERROR;
  }
  entries = levelEntries(ARENA_LEVELS, stored);
  chosen = pick ?? (entries.some((e) => e.id === chosen) ? chosen : entries[0]?.id ?? null);
  drawList(storeError);
  drawDetail();
}

document.querySelector<HTMLButtonElement>("#openLevelFile")!.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  fileInput.value = "";
  if (!file) return;
  const result = await storeLevelFile(await file.text());
  fileProblems.hidden = result.ok;
  fileProblems.textContent = result.errors.join(" ");
  if (result.ok) await refresh(`local:${result.key}`);
});

await refresh();
list.querySelector<HTMLElement>('.menu-item[aria-current="true"]')?.focus({ preventScroll: true });
