import editorData from "../../data/editor.json";
import type { Level, Prim, PrimBehaviour, PrimShape, Sky, Vec3 } from "../level/format";

// ED-02 stage 1: the level document the editor edits. Pure data: no DOM and
// no Three.js, so the undo list and the level can be tested headless.
// Every change is a command holding each prim's state either side of the
// change, on one undo list (design/EDITOR.md 4: "every change goes through
// one command list"), and a change listener tells the page to redraw.

/** The editor's tuning numbers, all from data/editor.json. */
export const EDITOR = editorData;
export const GRID: number = editorData.grid;
export const ROTATE_STEP: number = editorData.rotateStep;
export const PALETTE: string[] = editorData.palette;
export const LIMITS = editorData.limits;

/** How many changes the undo list keeps. Every change holds whole prims, so
 *  the list is capped rather than allowed to grow with an afternoon's work. */
const HISTORY_CAP = 200;

/** One prim either side of a change. `key` is the id it had before the
 *  change, so a renamed prim is still found when undoing. No `before` means
 *  the change added it; no `after` means it removed it. */
export interface PrimEdit {
  key: string;
  before?: Prim;
  after?: Prim;
}

/** One entry on the undo list: prims changed, and optionally level fields
 *  other than the prims (the sky, the name). */
export interface Command {
  /** Plain words for the top bar, e.g. "add box-3". */
  text: string;
  prims: PrimEdit[];
  fields?: { before: Partial<Level>; after: Partial<Level> };
}

/** What the page may change of a prim in one go. */
export interface PrimPatch {
  id: string;
  patch: Partial<Prim>;
}

function applyPrims(level: Level, edits: PrimEdit[], side: "before" | "after") {
  const prims = (level.prims ??= []);
  for (const e of edits) {
    // Undoing finds the prim by the id it has after the change (a rename),
    // redoing finds it by the id it had before (the other way round).
    const key = side === "after" ? e.key : (e.after?.id ?? e.key);
    const i = prims.findIndex((p) => p.id === key);
    const next = side === "after" ? e.after : e.before;
    if (next) {
      if (i >= 0) prims[i] = next;
      else prims.push(next);
    } else if (i >= 0) {
      prims.splice(i, 1);
    }
  }
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
  /** The counter new ids come from: box-1, ramp-2, and so on. */
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

  /** A fresh id for a shape: the next number nothing is using. */
  nextId(shape: PrimShape): string {
    const used = new Set((this.current.prims ?? []).map((p) => p.id));
    let id: string;
    do {
      this.serial += 1;
      id = `${shape}-${this.serial}`;
    } while (used.has(id));
    return id;
  }

  /** The prim with that id, or undefined. */
  prim(id: string): Prim | undefined {
    return (this.current.prims ?? []).find((p) => p.id === id);
  }

  add(prim: Prim) {
    this.run({ text: `add ${prim.id}`, prims: [{ key: prim.id, after: prim }] });
  }

  remove(ids: string | string[]) {
    const list = typeof ids === "string" ? [ids] : ids;
    const prims: PrimEdit[] = [];
    for (const id of list) {
      const before = this.prim(id);
      if (before) prims.push({ key: id, before });
    }
    if (!prims.length) return;
    this.run({ text: prims.length === 1 ? `remove ${prims[0]!.key}` : `remove ${prims.length} prims`, prims });
  }

  /** Changes fields of one or more prims as one undo step (a typed value, a
   *  drag of the transform handles, a colour). Unknown ids are skipped. */
  change(edits: PrimPatch[], text?: string) {
    const prims: PrimEdit[] = [];
    for (const e of edits) {
      const before = this.prim(e.id);
      if (!before) continue;
      prims.push({ key: e.id, before, after: { ...before, ...e.patch } });
    }
    if (!prims.length) return;
    this.run({ text: text ?? (prims.length === 1 ? `change ${prims[0]!.key}` : `change ${prims.length} prims`), prims });
  }

  /** Copies the prims with fresh ids, moved by `offset` metres. Returns the
   *  new ids, in the order the old ones were given. */
  duplicate(ids: string[], offset: Vec3 = [GRID, 0, GRID]): string[] {
    const prims: PrimEdit[] = [];
    const made: string[] = [];
    for (const id of ids) {
      const from = this.prim(id);
      if (!from) continue;
      const copy = snapPrim({
        ...from,
        id: this.nextId(from.shape),
        pos: [from.pos[0] + offset[0], from.pos[1] + offset[1], from.pos[2] + offset[2]],
      });
      prims.push({ key: copy.id, after: copy });
      made.push(copy.id);
    }
    if (prims.length) this.run({ text: `duplicate ${prims.length} prim${prims.length === 1 ? "" : "s"}`, prims });
    return made;
  }

  /** Changes level fields other than the prims, as one undo step: the sky,
   *  the level's name. Only the keys given are touched. */
  setFields(patch: Partial<Level>, text = "change level") {
    const before: Partial<Level> = {};
    for (const key of Object.keys(patch) as (keyof Level)[]) {
      (before as Record<string, unknown>)[key] = this.current[key];
    }
    this.run({ text, prims: [], fields: { before, after: patch } });
  }

  undo() {
    const command = this.undoList.pop();
    if (!command) return;
    applyPrims(this.current, command.prims, "before");
    if (command.fields) Object.assign(this.current, command.fields.before);
    this.redoList.push(command);
    this.emit();
  }

  redo() {
    const command = this.redoList.pop();
    if (!command) return;
    applyPrims(this.current, command.prims, "after");
    if (command.fields) Object.assign(this.current, command.fields.after);
    this.undoList.push(command);
    this.emit();
  }

  private run(command: Command) {
    applyPrims(this.current, command.prims, "after");
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
