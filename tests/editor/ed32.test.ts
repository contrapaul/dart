import { describe, expect, it } from "vitest";
import { LevelDoc, newLevel } from "../../src/editor/doc";
import { makeLight, LIGHT_DEFAULTS } from "../../src/editor/lights-editor";
import { markerFor } from "../../src/editor/markers";
import type { LevelLight } from "../../src/level/format";
import { validateLevel } from "../../src/level/validate";
import ed01 from "../../data/levels/ed-01.json";

// ED-32: the editor's Light tool. The factory, the document and the marker
// the view draws.

describe("ED-32 the Light tool", () => {
  it("places a point light off the surface along the normal", () => {
    const l = makeLight("light-1", [1, 0, 2], "point", 0.5, [0, 1, 0]);
    expect(l.pos).toEqual([1, 0.5, 2]);
    expect(l.kind).toBe("point");
    expect(l.colour).toBe(LIGHT_DEFAULTS.colour);
    expect(l.intensity).toBe(LIGHT_DEFAULTS.intensity);
    expect(l.range).toBe(LIGHT_DEFAULTS.range);
    expect(l.angle).toBeUndefined();
  });

  it("places a spot light with its cone defaults", () => {
    const l = makeLight("light-1", [0, 1, 0], "spot", 0.5, [0, 1, 0]);
    expect(l.angle).toBe(45);
    expect(l.softness).toBeCloseTo(0.3, 5);
  });

  it("adds, undoes and redoes a placed light", () => {
    const d = new LevelDoc(newLevel());
    const l = makeLight("light-1", [1, 0, 1], "point", 0.5, [0, 1, 0]);
    d.add("lights", l);
    expect(d.find<LevelLight>("lights", "light-1")).toBeDefined();
    d.undo();
    expect(d.find<LevelLight>("lights", "light-1")).toBeUndefined();
    d.redo();
    expect(d.find<LevelLight>("lights", "light-1")).toEqual(l);
  });

  it("validates a placed light in the level", () => {
    const base = ed01 as unknown as ReturnType<typeof newLevel>;
    const ok = validateLevel({ ...base, lights: [makeLight("light-1", [1, 1, 1], "spot")] });
    expect(ok.errors).toEqual([]);
  });

  it("draws a marker for a placed light, with a cone for a spot", () => {
    const point = markerFor("lights", makeLight("light-1", [0, 1, 0], "point") as never);
    expect(point.object.type).toBe("Group");
    expect(point.size).toBeNull();
    expect(point.object.children.length).toBe(1);
    const spot = markerFor("lights", makeLight("light-2", [0, 1, 0], "spot", 0, [0, 1, 0]) as never);
    expect(spot.object.children.length).toBe(2);
    const cone = spot.object.children[1]!;
    expect((cone as { geometry?: { type?: string } }).geometry?.type).toBe("ConeGeometry");
    // The cone hangs below the light, tip at it: its centre is half the
    // range down, pointing the way the light aims.
    expect(cone.position.y).toBeCloseTo(-8 / 2, 5);
  });
});
