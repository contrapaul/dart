import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { LevelDoc, ENTRY_KINDS, KIND_PREFIX, newLevel } from "../../src/editor/doc";
import { PHYSICS_SHAPES, makePhysicsObject } from "../../src/editor/physics-editor";
import { markerFor } from "../../src/editor/markers";
import { HELP } from "../../src/editor/help";
import { validateLevel } from "../../src/level/validate";
import type { Level } from "../../src/level/format";

// ED-33: the editor's Physics tool. The page itself needs a browser, but
// the factory, the marker and the validator do not, so a placed object is
// checked headless: it stands on the surface it was clicked and a file with
// it in loads.

function level(): Level {
  return newLevel() as unknown as Level;
}

describe("the Physics tool", () => {
  it("is one of the editor's kinds, with its own id prefix", () => {
    expect(ENTRY_KINDS).toContain("physics");
    expect(KIND_PREFIX.physics).toBe("object");
  });

  it("offers a box, a cylinder and a ball", () => {
    expect(PHYSICS_SHAPES.map((s) => s.value)).toEqual(["box", "cylinder", "sphere"]);
  });

  it("places an object standing on the surface, snapped", () => {
    const o = makePhysicsObject("object-1", "box", "#ff7a1a", [2, 0, 3], [0, 1, 0]);
    expect(o.shape).toBe("box");
    // The centre is half its height up, so its foot is on the floor.
    expect(o.pos[1]).toBeCloseTo(o.size[1] / 2, 5);
    expect(o.pos[0]).toBeCloseTo(2, 5);
    expect(o.pos[2]).toBeCloseTo(3, 5);
    expect(o.mass).toBeGreaterThan(0);
    expect(o.damage).toBeGreaterThanOrEqual(0);
  });

  it("makes a file the validator loads", () => {
    const doc = new LevelDoc(level());
    const made = makePhysicsObject(doc.nextId("object"), "cylinder", "#2ec4ff", [0, 0, 0], [0, 1, 0]);
    doc.add("physics", made);
    const result = validateLevel(doc.level as unknown as Level);
    expect(result.errors.filter((e) => e.includes(made.id))).toEqual([]);

    // A breakable one needs its hit points, as the inspector writes them.
    doc.change("physics", [{ id: made.id, patch: { breakable: true, hitPoints: 20 } }], "breakable");
    const again = validateLevel(doc.level as unknown as Level);
    expect(again.errors.filter((e) => e.includes(made.id))).toEqual([]);
  });
});

describe("the physics marker", () => {
  it("is the shape in its colour, the size the object is", () => {
    const boxed = makePhysicsObject("object-1", "box", "#ff7a1a", [0, 0, 0], [0, 1, 0]);
    const cylinder = { ...boxed, id: "object-2", shape: "cylinder" as const };
    const ball = { ...boxed, id: "object-3", shape: "sphere" as const };
    const boxMarker = markerFor("physics", boxed);
    const cylinderMarker = markerFor("physics", cylinder);
    const ballMarker = markerFor("physics", ball);
    expect(boxMarker.size).toEqual(boxed.size);
    expect(boxMarker.pos).toEqual(boxed.pos);
    const geometryOf = (m: THREE.Object3D) => ((m as THREE.Mesh).geometry as THREE.BufferGeometry).type;
    expect(geometryOf(boxMarker.object)).toBe("BoxGeometry");
    expect(geometryOf(cylinderMarker.object)).toBe("CylinderGeometry");
    expect(geometryOf(ballMarker.object)).toBe("SphereGeometry");
  });
});

describe("the help text", () => {
  it("says the editor does not simulate and play is the drop test", () => {
    const rows = HELP.flatMap((s) => s.rows);
    const row = rows.find(([what]) => what === "Physics objects");
    expect(row).toBeDefined();
    expect(row![1]).toMatch(/drop test/i);
    expect(row![1]).toMatch(/does not simulate/i);
  });
});
