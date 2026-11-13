import { describe, expect, it } from "vitest";
import { LevelDoc, makePrim, newLevel, snapPrim, snapVec3 } from "../../src/editor/doc";
import { validateLevel } from "../../src/level/validate";
import type { Prim } from "../../src/level/format";

const box: Prim = { id: "box-9", shape: "box", pos: [1, 1, 1], size: [2, 2, 2], colour: "#ff7a1a", behaviour: "solid" };

function doc(): LevelDoc {
  const d = new LevelDoc(newLevel());
  return d;
}

describe("ED-02 the level document", () => {
  it("starts as the smallest valid level", () => {
    const level = newLevel();
    expect(validateLevel(level).errors).toEqual([]);
    expect(level.prims?.length).toBe(1);
    expect(level.prims?.[0]?.size).toEqual([32, 1, 32]);
    expect(level.sky).toEqual({ kind: "gradient", top: "#3a6ff0", horizon: "#bfe3ff", bottom: "#3a3550" });
    expect(level.playerStart.pos).toEqual([0, 0, 8]);
    expect(level.exit.pos).toEqual([0, 0, -14]);
  });

  it("adds and undoes and redoes an add", () => {
    const d = doc();
    d.add("prims", box);
    expect(d.prim("box-9")).toEqual(box);
    expect(d.canUndo).toBe(true);
    d.undo();
    expect(d.prim("box-9")).toBeUndefined();
    expect(d.canRedo).toBe(true);
    d.redo();
    expect(d.prim("box-9")).toEqual(box);
  });

  it("changes fields and undoes and redoes the change", () => {
    const d = doc();
    d.add("prims", box);
    d.change("prims", [{ id: "box-9", patch: { pos: [4, 0, 4], colour: "#2ec4ff" } }]);
    expect(d.prim("box-9")?.pos).toEqual([4, 0, 4]);
    expect(d.prim("box-9")?.colour).toBe("#2ec4ff");
    d.undo();
    expect(d.prim("box-9")).toEqual(box);
    d.redo();
    expect(d.prim("box-9")?.pos).toEqual([4, 0, 4]);
  });

  it("changes several prims as one step", () => {
    const d = doc();
    d.add("prims", box);
    d.add("prims", { ...box, id: "box-10", pos: [5, 1, 5] });
    d.change("prims", [
      { id: "box-9", patch: { colour: "#b6ff3b" } },
      { id: "box-10", patch: { colour: "#b6ff3b" } },
    ]);
    d.undo();
    expect(d.prim("box-9")?.colour).toBe("#ff7a1a");
    expect(d.prim("box-10")?.colour).toBe("#ff7a1a");
    expect(d.canUndo).toBe(true);
  });

  it("removes and undoes and redoes a remove", () => {
    const d = doc();
    d.add("prims", box);
    d.remove("box-9");
    expect(d.prim("box-9")).toBeUndefined();
    d.undo();
    expect(d.prim("box-9")).toEqual(box);
    d.redo();
    expect(d.prim("box-9")).toBeUndefined();
  });

  it("undoes a rename by the old id", () => {
    const d = doc();
    d.add("prims", box);
    d.change("prims", [{ id: "box-9", patch: { id: "wall-1" } }]);
    expect(d.prim("wall-1")).toBeDefined();
    d.undo();
    expect(d.prim("box-9")).toBeDefined();
    expect(d.prim("wall-1")).toBeUndefined();
  });

  it("clears the redo list when a new change is made", () => {
    const d = doc();
    d.add("prims", box);
    d.undo();
    expect(d.canRedo).toBe(true);
    d.add("prims", { ...box, id: "box-11" });
    expect(d.canRedo).toBe(false);
    d.undo();
    expect(d.prim("box-9")).toBeUndefined();
  });

  it("undoes a level field change, the sky", () => {
    const d = doc();
    d.setFields({ sky: { kind: "gradient", top: "#000000", horizon: "#111111", bottom: "#222222" } });
    expect(d.level.sky).toEqual({ kind: "gradient", top: "#000000", horizon: "#111111", bottom: "#222222" });
    d.undo();
    expect(d.level.sky).toEqual({ kind: "gradient", top: "#3a6ff0", horizon: "#bfe3ff", bottom: "#3a3550" });
  });

  it("duplicates with fresh ids", () => {
    const d = doc();
    d.add("prims", box);
    const ids = d.duplicate("prims", ["box-9"]);
    expect(ids.length).toBe(1);
    expect(ids[0]).not.toBe("box-9");
    expect(d.prim(ids[0]!)).toBeDefined();
    expect(d.prim(ids[0]!)?.size).toEqual(box.size);
    expect(d.prim("box-9")).toBeDefined();
    const again = d.duplicate("prims", ["box-9", "box-9"]);
    expect(new Set([...again, "box-9"]).size).toBe(3);
    d.undo();
    expect(d.prim(again[0]!)).toBeUndefined();
  });

  it("tells its listeners about every change, undo and redo", () => {
    const d = doc();
    let calls = 0;
    const off = d.onChange(() => calls++);
    d.add("prims", box);
    d.undo();
    d.redo();
    expect(calls).toBe(3);
    off();
    d.remove("box-9");
    expect(calls).toBe(3);
  });

  it("loads a level and clears the history", () => {
    const d = doc();
    d.add("prims", box);
    d.load(newLevel());
    expect(d.canUndo).toBe(false);
    expect(d.canRedo).toBe(false);
    expect(d.prim("box-9")).toBeUndefined();
  });

  it("makes an id nothing is using", () => {
    const d = doc();
    const a = d.nextId("box");
    d.add("prims", { ...box, id: a });
    expect(d.nextId("box")).not.toBe(a);
    expect(d.nextId("ramp")).toMatch(/^ramp-\d+$/);
  });

  it("makes a prim for each palette shape", () => {
    const plus: Prim = { ...makePrim("box", [1.2, 0, 3.7], "#ff7a1a"), id: "plus-1" };
    expect(plus.pos).toEqual([1, 0, 3.5]);
    expect(makePrim("stairs", [0, 0, 0], "#ff7a1a").steps).toBe(4);
    for (const shape of ["box", "ramp", "wedge", "cylinder", "stairs"] as const) {
      const p = { ...makePrim(shape, [0, 0, 0], "#ff7a1a"), id: `${shape}-1` };
      const base = newLevel();
      expect(validateLevel({ ...base, prims: [...(base.prims ?? []), p] }).errors).toEqual([]);
    }
  });
});

describe("ED-02 snapping", () => {
  it("rounds position, size and rotation to their steps", () => {
    expect(snapVec3([1.24, -0.26, 3.7], 0.5)).toEqual([1, -0.5, 3.5]);
    const snapped = snapPrim({
      ...box,
      pos: [1.2, 0.3, 2.9],
      size: [1.1, 2.4, 3.2],
      rot: [7, 22, 91],
    });
    expect(snapped.pos).toEqual([1, 0.5, 3]);
    expect(snapped.size).toEqual([1, 2.5, 3]);
    expect(snapped.rot).toEqual([0, 15, 90]);
  });

  it("keeps a size at least one grid step and wraps rotation", () => {
    const snapped = snapPrim({ ...box, size: [0.1, 0.1, 0.1], rot: [-15, 375, 0] });
    expect(snapped.size).toEqual([0.5, 0.5, 0.5]);
    expect(snapped.rot).toEqual([345, 15, 0]);
  });
});
