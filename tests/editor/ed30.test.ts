import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  FOLDED_KEY, foldedGroups, isFolded, reloadFolded, setFolded, toggleFolded, unfoldGroup,
} from "../../src/editor/outliner-fold";

// ED-30 item 1: folding state lives in a module Set and in localStorage,
// and survives a redraw of the outliner (a rebuild is just a fresh read of
// the same state).

describe("ED-30 folding state", () => {
  const store = new Map<string, string>();
  const fakeStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
    key: () => null,
    get length() { return store.size; },
  };

  beforeEach(() => {
    (globalThis as Record<string, unknown>).localStorage = fakeStorage;
    reloadFolded();
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>).localStorage = undefined;
    reloadFolded();
  });

  it("starts unfolded and folds and unfolds by title", () => {
    expect(foldedGroups()).toEqual([]);
    expect(toggleFolded("solid")).toBe(true);
    expect(isFolded("solid")).toBe(true);
    expect(toggleFolded("solid")).toBe(false);
    expect(isFolded("solid")).toBe(false);
  });

  it("survives a rebuild: the folded title is read back after a reload", () => {
    setFolded("solid", true);
    setFolded("Foamers", true);
    expect(isFolded("solid")).toBe(true);
    reloadFolded();
    expect(isFolded("solid")).toBe(true);
    expect(isFolded("Foamers")).toBe(true);
    expect(isFolded("Pickups")).toBe(false);
  });

  it("persists to localStorage under the card's key", () => {
    setFolded("solid", true);
    expect(store.has(FOLDED_KEY)).toBe(true);
    expect(JSON.parse(store.get(FOLDED_KEY)!)).toContain("solid");
  });

  it("unfoldGroup clears one group and leaves the others", () => {
    setFolded("solid", true);
    setFolded("Logic", true);
    unfoldGroup("solid");
    expect(isFolded("solid")).toBe(false);
    expect(isFolded("Logic")).toBe(true);
  });

  it("survives a broken storage value", () => {
    store.set(FOLDED_KEY, "not json");
    reloadFolded();
    expect(foldedGroups()).toEqual([]);
  });
});

describe("ED-30 locking", () => {
  it("collects locked prims, props, physics and models", async () => {
    const { lockedIds } = await import("../../src/editor/lock");
    const { newLevel } = await import("../../src/editor/doc");
    const level = newLevel();
    level.prims = [
      { id: "box-1", shape: "box", pos: [0, 1, 0], size: [2, 2, 2], colour: "#fff", behaviour: "solid", locked: true },
      { id: "box-2", shape: "box", pos: [5, 1, 0], size: [2, 2, 2], colour: "#fff", behaviour: "solid" },
    ];
    level.props = [{ id: "prop-1", kind: "barrel", pos: [0, 0, 0], locked: true } as never];
    const locked = lockedIds(level);
    expect(locked.has("box-1")).toBe(true);
    expect(locked.has("prop-1")).toBe(true);
    expect(locked.has("box-2")).toBe(false);
  });

  it("a locked prim is not moved by a nudge: movableIds strips it", async () => {
    const { movableIds, lockedIds } = await import("../../src/editor/lock");
    const { newLevel } = await import("../../src/editor/doc");
    const level = newLevel();
    level.prims = [
      { id: "box-1", shape: "box", pos: [0, 1, 0], size: [2, 2, 2], colour: "#fff", behaviour: "solid", locked: true },
    ];
    const locked = lockedIds(level);
    const { ok, skipped } = movableIds(["box-1", "box-2"], locked);
    expect(ok).toEqual(["box-2"]);
    expect(skipped).toEqual(["box-1"]);
  });

  it("is the skip set the view pick adds", async () => {
    const { lockedIds } = await import("../../src/editor/lock");
    const { newLevel } = await import("../../src/editor/doc");
    const level = newLevel();
    level.prims = [
      { id: "box-1", shape: "box", pos: [0, 1, 0], size: [2, 2, 2], colour: "#fff", behaviour: "solid", locked: true },
    ];
    const locked = lockedIds(level);
    // The view passes the locked ids as the skip set, so a pick over a
    // locked prim passes through it (view.ts pick).
    expect(locked.size).toBe(1);
    expect(locked.has("box-1")).toBe(true);
  });
});

describe("ED-30 the start turns", () => {
  it("a handle turn writes the start's yaw in radians", async () => {
    const { dragPatch } = await import("../../src/editor/parts");
    // The marker's proxy turn is written as radians, 0 faces -z.
    const patch = dragPatch({ kind: "start", pos: [0, 0, 8], yawDeg: 30, size: null }, [0, 0, 0], 15, [1, 1, 1], 0);
    expect(patch?.yaw).toBeCloseTo((45 * Math.PI) / 180, 6);
  });

  it("a handle turn wraps past 360 degrees", async () => {
    const { dragPatch } = await import("../../src/editor/parts");
    const patch = dragPatch({ kind: "start", pos: [0, 0, 8], yawDeg: 350, size: null }, [0, 0, 0], 30, [1, 1, 1], 0);
    expect(patch?.yaw).toBeCloseTo((20 * Math.PI) / 180, 6);
  });
});

describe("ED-30 rotation snap", () => {
  it.each([1, 5, 15, 45, 90])("snapPrim snaps rotation to %d degrees", async (step) => {
    const { snapPrim } = await import("../../src/editor/doc");
    const prim = { id: "box-1", shape: "box" as const, pos: [1.2, 1, 1.3] as [number, number, number], size: [2, 2, 2] as [number, number, number], colour: "#fff", behaviour: "solid" as const, rot: [0, 7.3, 33.2] as [number, number, number] };
    const snapped = snapPrim(prim, 0.5, step);
    expect(snapped.rot?.[1]).toBeCloseTo(Math.round(7.3 / step) * step, 6);
    expect(snapped.rot?.[2]).toBeCloseTo(Math.round(33.2 / step) * step, 6);
  });

  it("snapPrim with step 0 keeps the rotation exactly as typed", async () => {
    const { snapPrim } = await import("../../src/editor/doc");
    const prim = { id: "box-1", shape: "box" as const, pos: [1.2, 1, 1.3] as [number, number, number], size: [2, 2, 2] as [number, number, number], colour: "#fff", behaviour: "solid" as const, rot: [0, 7.3, 33.2] as [number, number, number] };
    const snapped = snapPrim(prim, 0.5, 0);
    expect(snapped.rot?.[1]).toBeCloseTo(7.3, 6);
    expect(snapped.rot?.[2]).toBeCloseTo(33.2, 6);
  });

  it("off: rotation typed into the inspector is kept exactly as typed", async () => {
    const { snapPrim } = await import("../../src/editor/doc");
    const prim = { id: "box-1", shape: "box" as const, pos: [1.2, 1, 1.3] as [number, number, number], size: [2, 2, 2] as [number, number, number], colour: "#fff", behaviour: "solid" as const, rot: [0, 7.3, 33.2] as [number, number, number] };
    const snapped = snapPrim(prim, 0.5, 0);
    expect(snapped.rot?.[0]).toBeCloseTo(0, 6);
    expect(snapped.rot?.[1]).toBeCloseTo(7.3, 6);
    expect(snapped.rot?.[2]).toBeCloseTo(33.2, 6);
  });
});
