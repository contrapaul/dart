import type { Vec3 } from "../level/format";
import { LOCAL_PREFIX } from "./store";

// ED-09 stage 1: the way from the editor into the game and back. The editor
// saves the level, then opens `arena.html?level=local:<key>&from=editor`,
// with `&start=x,y,z,yaw` when the camera is where the run should begin.
// The arena page reads `start` for that run only, and `from=editor` puts a
// Back to the editor button in its pause panel. Plain strings and numbers,
// so the URLs can be tested without a browser.

/** Where a run begins: feet position and yaw in radians (0 faces -z). */
export interface PlayStart {
  pos: Vec3;
  yaw: number;
}

/** A number as the URL writes it: three decimals at most, and no "-0". */
function num(n: number): string {
  const rounded = Math.round(n * 1000) / 1000;
  return String(rounded === 0 ? 0 : rounded);
}

/** The `start` parameter's value: x,y,z,yaw. */
export function startParam(start: PlayStart): string {
  return [...start.pos.map(num), num(start.yaw)].join(",");
}

/** The arena URL for a stored level, played from the editor. `start` is the
 *  camera's spot when Shift+P was pressed, or null for the level's own
 *  player start. */
export function playUrl(key: string, start: PlayStart | null = null, frame = false): string {
  const params = new URLSearchParams();
  params.set("level", LOCAL_PREFIX + key);
  params.set("from", "editor");
  if (start) params.set("start", startParam(start));
  if (frame) params.set("frame", "1");
  return `arena.html?${params.toString()}`;
}

/** ED-11: true when the arena page was opened in the editor's frame
 *  (`frame=1`). It then shows no title menu and no pause panel, and tells
 *  the editor to close it instead of going anywhere itself. */
export function isFramed(search: string): boolean {
  return new URLSearchParams(search).get("frame") === "1";
}

/** ED-11: what the framed arena page posts to the editor to be closed. */
export const CLOSE_MESSAGE = "dart:close-playtest";

/** ED-11: whether a message closes the playtest. Only the editor's own
 *  frame, on the editor's own origin, saying the close words, may. */
export function acceptClose(
  event: { data: unknown; origin: string; source: unknown },
  ownOrigin: string,
  frameWindow: unknown,
): boolean {
  return frameWindow != null && event.source === frameWindow
    && event.origin === ownOrigin && event.data === CLOSE_MESSAGE;
}

/** Where a run begins: the `start` parameter overrides the level's own player
 *  start for this run only, and the level file is not touched. Resolved once
 *  when the page starts, so a restart comes back to the same spot. */
export function spawnFor(levelStart: PlayStart, start: PlayStart | null): PlayStart {
  return start ? { pos: [...start.pos] as Vec3, yaw: start.yaw } : { pos: [...levelStart.pos] as Vec3, yaw: levelStart.yaw };
}

/** The `start` a page was opened with, or null when it has none or it is not
 *  four numbers. */
export function parseStart(search: string): PlayStart | null {
  const text = new URLSearchParams(search).get("start");
  if (!text) return null;
  const parts = text.split(",").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [x, y, z, yaw] = parts as [number, number, number, number];
  return { pos: [x, y, z], yaw };
}

/** The editor URL the pause panel's Back to the editor button goes to, or
 *  null when the page was not opened from the editor or the level is not a
 *  stored one. */
export function editorBackUrl(search: string): string | null {
  const params = new URLSearchParams(search);
  if (params.get("from") !== "editor") return null;
  const level = params.get("level") ?? "";
  if (!level.startsWith(LOCAL_PREFIX)) return null;
  const key = level.slice(LOCAL_PREFIX.length);
  if (!key) return null;
  return `editor.html?open=${encodeURIComponent(key)}`;
}
