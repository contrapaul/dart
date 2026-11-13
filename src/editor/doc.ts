import editorData from "../../data/editor.json";
import type {
  Box, Level, PlayerStart, Prim, PrimBehaviour, PrimShape, Sky, Vec3,
} from "../level/format";

// ED-02 stage 1: the level document the editor edits. Pure data: no DOM and
// no Three.js, so the undo list and the level can be tested headless.
// Every change is a command holding each thing's state either side of the
// change, on one undo list (design/EDITOR.md 4: "every change goes through
// one command list"), and a change listener tells the page to redraw.
//
// ED-05 stage 1: the same commands serve every kind of placed thing, not
// just the prims. The level stores them in separate arrays but one id space
// covers them all (validate.ts claims a single set), so a command names a
// kind as well as an id.

/** The editor's tuning numbers, all from data/editor.json. */
export const EDITOR = editorData;
export const GRID: number = editorData.grid;
export const ROTATE_STEP: number = editorData.rotateStep;
export const PALETTE: string[] = editorData.palette;
export const LIMITS = editorData.limits;

/** How many changes the undo list keeps. Every change holds whole prims, so
 *  the list is capped rather than allowed to grow with an afternoon's work. */
const HISTORY_CAP = 200;

/** The level's arrays of things with an id, one per kind the editor places
 *  (ED-05). The player start and the exit are single objects changed
 *  through the level fields, like the sky and the name. */
export type EntryKind = "prims" | "foamers" | "pickups" | "doors" | "spawnPoints" | "zones";

export const ENTRY_KINDS: readonly EntryKind[] = ["prims", "foamers", "pickups", "doors", "spawnPoints", "zones"];

/** The id prefix a kind's new ids take, and the name the outliner and the
 *  status line use for it. */
export const KIND_PREFIX: Record<EntryKind, string> = {
  prims: "box",
  foamers: "foamer",
  pickups: "pickup",
  doors: "door",
  spawnPoints: "spawn",
  zones: "zone",
};

/** Anything the editor places: it has an id, and that is all the commands
 *  need. The kind's own type (Prim, Pickup, ...) is checked at the call. */
export interface IdEntry {
  id: string;
  pos: Vec3;
}

/** One kind's entry either side of a change. `key` is the id it had before
 *  the change, so a renamed entry is still found when undoing. No `before`
 *  means the change added it; no `after` means it removed it. */
export interface EntryEdit {
  kind: EntryKind;
  key: string;
  before?: IdEntry;
  after?: IdEntry;
}

/** One entry on the undo list: things changed, and optionally level fields
 *  other than the arrays (the sky, the name, the start, the exit). */
export interface Command {
  /** Plain words for the top bar, e.g. "add box-3". */
  text: string;
  entries: EntryEdit[];
  fields?: { before: Partial<Level>; after: Partial<Level> };
}

/** What the page may change of one entry in one go. */
export interface EntryPatch {
  id: string;
  patch: Record<string, unknown>;
}

/** The level's array for a kind, made on first use. */
function listOf(level: Level, kind: EntryKind): IdEntry[] {
  const record = level as unknown as Record<string, IdEntry[] | undefined>;
  return (record[kind] ??= []);
}

function applyEntries(level: Level, edits: EntryEdit[], side: "before" | "after") {
  for (const e of edits) {
    const list = listOf(level, e.kind);
    // Undoing finds the entry by the id it has after the change (a rename),
    // redoing finds it by the id it had before (the other way round).
    const key = side === "after" ? e.key : (e.after?.id ?? e.key);
    const i = list.findIndex((p) => p.id === key);
    const next = side === "after" ? e.after : e.before;
    if (next) {
      if (i >= 0) list[i] = next;
      else list.push(next);
    } else if (i >= 0) {
      list.splice(i, 1);
    }
  }
}

/** The id prefix a copy of this entry takes: its own, so a duplicated
 *  pickup is another pickup and not another prim. */
function idPrefix(kind: EntryKind, entry: IdEntry): string {
  const own = entry.id.replace(/[-_]?\d+$/, "");
  return own || KIND_PREFIX[kind];
}

/** Rounds to a step, for grid snap on position and size. */
export function snapValue(v: number, step: number): number {
  if (!(step > 0)) return v;
  return Math.round(v / step) * step;
}

export function snapVec3(v: Vec3, step: number): Vec3 {
  return [snapValue(v[0], step), snapValue(v[1], step), snapValue(v[2], step)];
}

/** A snapped copy of the prim: position and size on the grid, rotation on
 *  `rotateStep` degrees. Size stays at least one grid step, since a prim's
 *  size must be positive. */
export function snapPrim(prim: Prim, grid = GRID, rotateStep = ROTATE_STEP): Prim {
  const size = snapVec3(prim.size, grid).map((n) => Math.max(grid, n)) as Vec3;
  const rot = prim.rot
    ? (snapVec3(prim.rot, rotateStep).map((d) => ((d % 360) + 360) % 360) as Vec3)
    : undefined;
  return { ...prim, pos: snapVec3(prim.pos, grid), size, rot };
}

/** The default size of a shape placed from the palette, metres. */
export const SHAPE_SIZE: Record<PrimShape, Vec3> = {
  box: [2, 2, 2],
  ramp: [2, 1, 3],
  wedge: [2, 2, 2],
  cylinder: [2, 2, 2],
  stairs: [2, 2, 3],
};

/** A fresh prim of a shape, ready for the palette to place. */
export function makePrim(
  shape: PrimShape, pos: Vec3, colour: string, behaviour: PrimBehaviour = "solid",
): Omit<Prim, "id"> {
  const prim: Omit<Prim, "id"> = {
    shape,
    pos: snapVec3(pos, GRID),
    size: SHAPE_SIZE[shape].slice() as Vec3,
    colour,
    behaviour,
  };
  if (shape === "stairs") prim.steps = 4;
  return prim;
}

/** The smallest valid level (task ED-02): a 32 m floor, the player start,
 *  the exit and the default sky from data/editor.json. */
export function newLevel(): Level {
  return {
    meta: { id: "untitled", name: "[Paul]", act: 0, targetSeconds: 300, accent: PALETTE[0]! },
    shell: [],
    prims: [{
      id: "floor-1", shape: "box", pos: [0, -0.5, 0], size: [32, 1, 32],
      colour: "#6f6788", behaviour: "solid",
    }],
    playerStart: { pos: [0, 0, 8], yaw: 0 },
    exit: { pos: [0, 0, -14], size: [2, 1, 2] },
    sky: { ...editorData.sky } as Sky,
  };
}

/** The level document. Hand it a level (the editor's own, or a copy of a
 *  built in one) and every change it makes is undoable. */
export class LevelDoc {
  private current: Level;
  private undoList: Command[] = [];
  private redoList: Command[] = [];
  private listeners = new Set<() => void>();
  /** The counter new ids come from: box-1, ramp-2, key-3, and so on. */
  private serial = 0;

  constructor(level: Level = newLevel()) {
    this.current = level;
  }

  get level(): Level {
    return this.current;
  }

  get canUndo(): boolean {
    return this.undoList.length > 0;
  }

  get canRedo(): boolean {
    return this.redoList.length > 0;
  }

  /** Calls back after every change, undo and redo. Returns the unsubscribe. */
  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Replaces the whole level (New, Open, Import) and clears the history. */
  load(level: Level) {
    this.current = level;
    this.undoList = [];
    this.redoList = [];
    this.serial = 0;
    this.emit();
  }

  /** Every entry of a kind, in file order. */
  entries(kind: EntryKind): IdEntry[] {
    return listOf(this.current, kind);
  }

  /** The kind an id belongs to, or null. Ids are unique across the kinds
   *  (the validator's one id space), so one id names one thing. */
  kindOf(id: string): EntryKind | null {
    for (const kind of ENTRY_KINDS) {
      if (listOf(this.current, kind).some((e) => e.id === id)) return kind;
    }
    return null;
  }

  /** The entry with that id of a kind, or undefined. */
  find<T extends IdEntry = IdEntry>(kind: EntryKind, id: string): T | undefined {
    return listOf(this.current, kind).find((e) => e.id === id) as T | undefined;
  }

  /** The entry with that id, whatever kind it is. */
  entry(id: string): IdEntry | undefined {
    const kind = this.kindOf(id);
    return kind ? this.find(kind, id) : undefined;
  }

  /** The prim with that id, for the code that only deals in prims. */
  prim(id: string): Prim | undefined {
    return this.find<Prim>("prims", id);
  }

  /** A fresh id for a prefix: the next number nothing is using, in any
   *  kind, so `key-2` can never be a door or a prim too. */
  nextId(prefix: string): string {
    const used = new Set<string>();
    for (const kind of ENTRY_KINDS) for (const e of listOf(this.current, kind)) used.add(e.id);
    let id: string;
    do {
      this.serial += 1;
      id = `${prefix}-${this.serial}`;
    } while (used.has(id));
    return id;
  }

  add<T extends IdEntry>(kind: EntryKind, entry: T): T {
    this.run({ text: `add ${entry.id}`, entries: [{ kind, key: entry.id, after: entry }] });
    return entry;
  }

  remove(ids: string | string[]) {
    const list = typeof ids === "string" ? [ids] : ids;
    const entries: EntryEdit[] = [];
    for (const id of list) {
      const kind = this.kindOf(id);
      const before = kind && this.find(kind, id);
      if (kind && before) entries.push({ kind, key: id, before });
    }
    if (!entries.length) return;
    this.run({
      text: entries.length === 1 ? `remove ${entries[0]!.key}` : `remove ${entries.length} things`,
      entries,
    });
  }

  /** Changes fields of one or more entries of one kind as one undo step (a
   *  typed value, a drag of the transform handles, a colour). Unknown ids
   *  are skipped. */
  change(kind: EntryKind, edits: EntryPatch[], text?: string) {
    const entries: EntryEdit[] = [];
    for (const e of edits) {
      const before = this.find(kind, e.id);
      if (!before) continue;
      entries.push({ kind, key: e.id, before, after: { ...before, ...e.patch } });
    }
    if (!entries.length) return;
    this.run({
      text: text ?? (entries.length === 1 ? `change ${entries[0]!.key}` : `change ${entries.length} things`),
      entries,
    });
  }

  /** Copies entries of a kind with fresh ids, moved by `offset` metres.
   *  Returns the new ids, in the order the old ones were given. */
  duplicate(kind: EntryKind, ids: string[], offset: Vec3 = [GRID, 0, GRID]): string[] {
    const entries: EntryEdit[] = [];
    const made: string[] = [];
    for (const id of ids) {
      const from = this.find(kind, id);
      if (!from) continue;
      // Every kind carries a position and nothing else a copy must change:
      // a prim keeps its size and rotation, a door its size and lock. So the
      // copy is snapped on the grid at its new place.
      const copy = {
        ...from,
        id: this.nextId(idPrefix(kind, from)),
        pos: snapVec3([from.pos[0] + offset[0], from.pos[1] + offset[1], from.pos[2] + offset[2]], GRID),
      };
      entries.push({ kind, key: copy.id, after: copy as unknown as IdEntry });
      made.push(copy.id);
    }
    if (entries.length) this.run({ text: `duplicate ${entries.length} thing${entries.length === 1 ? "" : "s"}`, entries });
    return made;
  }

  /** Moves the player start, or turns it: the whole object, so a drag is one
   *  undo step. */
  setStart(patch: Partial<PlayerStart>, text = "move the start") {
    this.setFields({ playerStart: { ...this.current.playerStart, ...patch } }, text);
  }

  /** Moves or resizes the exit: the whole box, so a drag is one undo step. */
  setExit(patch: Partial<Box>, text = "move the exit") {
    this.setFields({ exit: { ...this.current.exit, ...patch } }, text);
  }

  /** Changes level fields other than the prims, as one undo step: the sky,
   *  the level's name. Only the keys given are touched. */
  setFields(patch: Partial<Level>, text = "change level") {
    const before: Partial<Level> = {};
    for (const key of Object.keys(patch) as (keyof Level)[]) {
      (before as Record<string, unknown>)[key] = this.current[key];
    }
    this.run({ text, entries: [], fields: { before, after: patch } });
  }

  undo() {
    const command = this.undoList.pop();
    if (!command) return;
    applyEntries(this.current, command.entries, "before");
    if (command.fields) Object.assign(this.current, command.fields.before);
    this.redoList.push(command);
    this.emit();
  }

  redo() {
    const command = this.redoList.pop();
    if (!command) return;
    applyEntries(this.current, command.entries, "after");
    if (command.fields) Object.assign(this.current, command.fields.after);
    this.undoList.push(command);
    this.emit();
  }

  private run(command: Command) {
    applyEntries(this.current, command.entries, "after");
    if (command.fields) Object.assign(this.current, command.fields.after);
    this.undoList.push(command);
    if (this.undoList.length > HISTORY_CAP) this.undoList.shift();
    // A new change after an undo is a new branch: the old redo is dropped.
    this.redoList = [];
    this.emit();
  }

  private emit() {
    for (const fn of [...this.listeners]) fn();
  }
}
