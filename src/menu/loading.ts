import type { Level } from "../level/format";
import { NO_AUTHOR } from "./level-list";

// MENU-01: the arena's loading screen names the level and its author while
// the game boots. The status line under them is the game's own.
export function showLoading(level: Level): void {
  const name = level.meta?.name || "[Paul]";
  const author = level.meta?.author || NO_AUTHOR;
  document.querySelector("#loadName")!.textContent = name;
  const by = document.querySelector<HTMLElement>("#loadAuthor")!;
  by.textContent = `by ${author}`;
  by.hidden = false;
  document.title = `DART: ${name}`;
}
