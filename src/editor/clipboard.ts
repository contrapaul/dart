import type { Level, Trigger, TriggerDo, TriggerWhen, Vec3 } from "../level/format";
import { ENTRY_KINDS, GRID, LIMITS, idPrefix, snapValue, type EntryKind, type IdEntry } from "./doc";

// ED-13: what box select, copy and paste and groups are made of. Pure data,
// no DOM and no Three.js: the page (src/editor/main.ts) owns the pointer,
// the keys and the system clipboard, and asks these for the answers.

/** A selection on the clipboard: its entries by kind, as they were in the
 *  level. It is plain JSON text, so it goes from one level to another, and
 *  from one browser tab to another. */
export interface Clip {
  dart: "dart-clip";
  version: 1;
  entries: Partial<Record<EntryKind, IdEntry[]>>;
}

/** An entry as the clipboard and the groups see it. */
type Thing = IdEntry & { group?: string; size?: Vec3 };

function listOf(level: Level, kind: EntryKind): Thing[] {
  return ((level as unknown as Record<string, Thing[] | undefined>)[kind] ?? []);
}

/** The selected entries as a clip. The start and the exit are not entries
 *  (a level has one of each), so they are never copied. */
export function makeClip(level: Level, ids: string[]): Clip {
  const want = new Set(ids);
  const entries: Clip["entries"] = {};
  for (const kind of ENTRY_KINDS) {
    const list = listOf(level, kind).filter((e) => want.has(e.id));
    if (list.length) entries[kind] = structuredClone(list);
  }
  return { dart: "dart-clip", version: 1, entries };
}

export function clipText(clip: Clip): string {
  return JSON.stringify(clip);
}

/** The clip a piece of clipboard text holds, or null when it is anything
 *  else (words copied from a page, another program's JSON, a newer clip). */
export function readClip(text: string): Clip | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  const clip = data as Partial<Clip> | null;
  if (!clip || typeof clip !== "object" || clip.dart !== "dart-clip" || clip.version !== 1) return null;
  if (!clip.entries || typeof clip.entries !== "object") return null;
  const entries: Clip["entries"] = {};
  for (const kind of ENTRY_KINDS) {
    const list = clip.entries[kind];
    if (list === undefined) continue;
    if (!Array.isArray(list) || list.some((e) => !e || typeof e.id !== "string")) return null;
    entries[kind] = list;
  }
  return { dart: "dart-clip", version: 1, entries };
}

/** Why a clip cannot be pasted into this level (a cap it would pass), or
 *  null when it can. */
export function capProblem(level: Level, clip: Clip): string | null {
  const caps: [EntryKind, number, string][] = [
    ["prims", LIMITS.prims, "prims"], ["foamers", LIMITS.foamers, "Foamers"], ["triggers", LIMITS.triggers, "triggers"], ["props", LIMITS.props, "props"],
  ];
  for (const [kind, cap, name] of caps) {
    const have = listOf(level, kind).length;
    const more = clip.entries[kind]?.length ?? 0;
    if (more && have + more > cap) return `Not pasted: ${have} ${name} here and ${more} more is over the cap of ${cap}.`;
  }
  return null;
}

function mapId(map: Map<string, string>, id: string): string {
  return map.get(id) ?? id;
}

/** A trigger with every id it names swapped for the copy made with it. An id
 *  whose thing was not copied keeps its name, so a pasted trigger still
 *  shows the wall it showed. */
function retarget(t: Trigger, map: Map<string, string>, move: Vec3): Trigger {
  const w = t.when;
  let when: TriggerWhen = w;
  if (w.kind === "enter") when = { ...w, zone: mapId(map, w.zone) };
  else if (w.kind === "killed") when = { ...w, ids: (w.ids ?? []).map((id) => mapId(map, id)) };
  else if (w.kind === "taken") when = { ...w, pickup: mapId(map, w.pickup) };
  else if (w.kind === "after") when = { ...w, trigger: mapId(map, w.trigger) };
  const rows = (t.do ?? []).map((d): TriggerDo => {
    if (d.kind === "spawn") return { ...d, id: mapId(map, d.id), at: d.at.map((id) => mapId(map, id)) };
    if (d.kind === "wake" || d.kind === "show" || d.kind === "hide") return { ...d, ids: (d.ids ?? []).map((id) => mapId(map, id)) };
    if (d.kind === "open" || d.kind === "close") return { ...d, door: mapId(map, d.door) };
    if (d.kind === "checkpoint") return { ...d, pos: [d.pos[0] + move[0], d.pos[1] + move[1], d.pos[2] + move[2]] };
    return d;
  });
  return { ...t, when, do: rows };
}

/** How far a paste moves the clip's things. With a point, the middle of the
 *  set lands on it, standing on it; without one, the set steps one grid
 *  square aside. The move is snapped (`grid`, 0 for no snap). ED-23's ghost
 *  uses it too, so the ghost is where the asset will land. */
export function pasteMove(clip: Clip, at: Vec3 | null, grid: number): Vec3 {
  const placed: Thing[] = [];
  for (const kind of ENTRY_KINDS) {
    if (kind === "triggers") continue;
    for (const e of (clip.entries[kind] ?? []) as Thing[]) if (e.pos) placed.push(e);
  }
  if (!at || !placed.length) return [GRID, 0, GRID];
  const xs = placed.map((e) => e.pos![0]);
  const zs = placed.map((e) => e.pos![2]);
  // A prim, a door and a zone are centred on their place; a Foamer, a
  // pickup and a spawn point stand on theirs.
  const foot = Math.min(...placed.map((e) => e.pos![1] - (e.size ? e.size[1] / 2 : 0)));
  return [
    snapValue(at[0] - (Math.min(...xs) + Math.max(...xs)) / 2, grid),
    snapValue(at[1] - foot, grid),
    snapValue(at[2] - (Math.min(...zs) + Math.max(...zs)) / 2, grid),
  ];
}

/** The clip's entries ready to add to a level: every one with a new id, its
 *  group swapped for a new one, and its place moved so the set keeps its
 *  shape. With a point, the middle of the set lands on it, standing on it;
 *  without one, the set steps one grid square aside. The move is snapped
 *  (`grid`, 0 for no snap), not the places, so things that were off the
 *  grid keep their spacing. */
export function pasteClip(
  clip: Clip,
  ids: { next(prefix: string): string; nextGroup(taken: Iterable<string>): string },
  at: Vec3 | null,
  grid: number,
): { kind: EntryKind; entry: IdEntry }[] {
  const move = pasteMove(clip, at, grid);

  const map = new Map<string, string>();
  const groups = new Map<string, string>();
  const made: { kind: EntryKind; entry: IdEntry }[] = [];
  for (const kind of ENTRY_KINDS) {
    for (const from of (clip.entries[kind] ?? []) as Thing[]) {
      const entry: Thing = { ...structuredClone(from), id: ids.next(idPrefix(kind, from)) };
      map.set(from.id, entry.id);
      if (entry.pos) entry.pos = [entry.pos[0] + move[0], entry.pos[1] + move[1], entry.pos[2] + move[2]];
      if (entry.group) {
        if (!groups.has(entry.group)) groups.set(entry.group, ids.nextGroup(groups.values()));
        entry.group = groups.get(entry.group)!;
      }
      made.push({ kind, entry });
    }
  }
  // A spawn row's own id is a tag a "killed" when may count, so it is new
  // in the copy too.
  for (const m of made) {
    if (m.kind !== "triggers") continue;
    for (const d of (m.entry as unknown as Trigger).do ?? []) {
      if (d.kind === "spawn" && d.id) map.set(d.id, ids.next(d.id.replace(/[-_]?\d+$/, "") || "spawn"));
    }
  }
  return made.map((m) => (m.kind === "triggers"
    ? { kind: m.kind, entry: retarget(m.entry as unknown as Trigger, map, move) as unknown as IdEntry }
    : m));
}

/** Everything in the same group as `id`, itself included. A thing in no
 *  group is its own group of one. */
export function groupMembers(level: Level, id: string): string[] {
  let group: string | undefined;
  for (const kind of ENTRY_KINDS) {
    const found = listOf(level, kind).find((e) => e.id === id);
    if (found) group = found.group;
  }
  if (!group) return [id];
  const out: string[] = [];
  for (const kind of ENTRY_KINDS) for (const e of listOf(level, kind)) if (e.group === group) out.push(e.id);
  return out;
}

/** The ids whose point on the screen is inside a dragged rectangle, in the
 *  order given. The rectangle's corners may come in any order. */
export function idsInRect(
  points: { id: string; x: number; y: number }[],
  rect: { x0: number; y0: number; x1: number; y1: number },
): string[] {
  const [left, right] = [Math.min(rect.x0, rect.x1), Math.max(rect.x0, rect.x1)];
  const [top, bottom] = [Math.min(rect.y0, rect.y1), Math.max(rect.y0, rect.y1)];
  return points.filter((p) => p.x >= left && p.x <= right && p.y >= top && p.y <= bottom).map((p) => p.id);
}
