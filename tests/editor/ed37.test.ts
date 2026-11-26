import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { transformSelection, yawOf, type GroupThing } from "../../src/editor/group-transform";
import type { Vec3 } from "../../src/level/format";

// ED-37: a selection of two or more things turns and scales as one object
// about the middle of its bounds, not each thing about its own centre.

const DEG = Math.PI / 180;

function turnY(deg: number): THREE.Quaternion {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(0, deg * DEG, 0, "XYZ"));
}

function box(id: string, pos: Vec3, rotDeg: Vec3 = [0, 0, 0], size: Vec3 = [1, 1, 1]): GroupThing {
  const e = new THREE.Euler(rotDeg[0] * DEG, rotDeg[1] * DEG, rotDeg[2] * DEG, "XYZ");
  const q = new THREE.Quaternion().setFromEuler(e);
  return {
    id, kind: "prims", pos, quat: [q.x, q.y, q.z, q.w],
    upright: false, turnKey: "rot", sizeKey: "size", size,
  };
}

function foamer(id: string, pos: Vec3, yawDeg = 0): GroupThing {
  const q = turnY(yawDeg);
  return {
    id, kind: "foamers", pos, quat: [q.x, q.y, q.z, q.w],
    upright: true, turnKey: "yaw", sizeKey: null, size: null,
  };
}

function patchOf(patches: ReturnType<typeof transformSelection>, id: string): Record<string, unknown> {
  return patches.find((p) => p.id === id)?.patch ?? {};
}

function rotOf(patches: ReturnType<typeof transformSelection>, id: string): Vec3 {
  return patchOf(patches, id).rot as Vec3;
}

function posOf(patches: ReturnType<typeof transformSelection>, id: string): Vec3 {
  return patchOf(patches, id).pos as Vec3;
}

describe("ED-37 a group turns and scales as one object", () => {
  it("two boxes side by side turned 90 about Y swap places round the pivot", () => {
    const a = box("a", [-1, 0, 0]);
    const b = box("b", [1, 0, 0]);
    const patches = transformSelection([a, b], [0, 0, 0], turnY(90), 1);
    // A box at -x swings to +z, a box at +x to -z: they swap ends.
    expect(posOf(patches, "a")).toEqual([0, 0, 1]);
    expect(posOf(patches, "b")).toEqual([0, 0, -1]);
    expect(rotOf(patches, "a")[1]).toBeCloseTo(90, 3);
    expect(rotOf(patches, "b")[1]).toBeCloseTo(90, 3);
    // Neither tipped: a turn about Y alone leaves X and Z at zero.
    expect(rotOf(patches, "a")[0]).toBeCloseTo(0, 3);
    expect(rotOf(patches, "a")[2]).toBeCloseTo(0, 3);
  });

  it("a box turned 30 on X, then the group turned 45 on Y, gives the composed Euler", () => {
    const a = box("a", [0, 0, 0], [30, 0, 0]);
    const patches = transformSelection([a], [0, 0, 0], turnY(45), 1);
    // Worked out by hand from Ry(45) * Rx(30), not by adding the angles.
    const rot = rotOf(patches, "a");
    expect(rot[0]).toBeCloseTo(39.2315, 3);
    expect(rot[1]).toBeCloseTo(37.7612, 3);
    expect(rot[2]).toBeCloseTo(-26.5651, 3);
  });

  it("scale 2 doubles sizes and distances from the pivot", () => {
    const a = box("a", [-2, 1, 0], [0, 0, 0], [1, 2, 3]);
    const b = box("b", [2, 1, 0], [0, 0, 0], [4, 1, 1]);
    const patches = transformSelection([a, b], [0, 1, 0], new THREE.Quaternion(), 2);
    expect(posOf(patches, "a")).toEqual([-4, 1, 0]);
    expect(posOf(patches, "b")).toEqual([4, 1, 0]);
    expect(patchOf(patches, "a").size).toEqual([2, 4, 6]);
    expect(patchOf(patches, "b").size).toEqual([8, 2, 2]);
  });

  it("a Foamer in the group keeps standing upright", () => {
    // A group turned about Y and tipped about X: the Foamer takes the turn
    // about Y only, and no tilt.
    const tipped = turnY(45).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(30 * DEG, 0, 0, "XYZ")));
    const f = foamer("f", [2, 0, 0]);
    const patches = transformSelection([f], [0, 0, 0], tipped, 1);
    const patch = patchOf(patches, "f");
    expect(patch.rot).toBeUndefined();
    expect(patch.yaw).toBeCloseTo(40.8934 * DEG, 4);
    // The place still swings with the whole group, tilt and all.
    expect(posOf(patches, "f")[0]).toBeCloseTo(Math.SQRT2, 4);
    expect(posOf(patches, "f")[2]).toBeCloseTo(-Math.SQRT2, 4);
  });

  it("a Foamer turned with the group keeps its yaw when it was already facing a way", () => {
    const f = foamer("f", [0, 0, 0], 10);
    const patches = transformSelection([f], [0, 0, 0], turnY(35), 1);
    expect(patchOf(patches, "f").yaw).toBeCloseTo(45 * DEG, 5);
  });

  it("writes nothing when the handles did not move, turn or scale", () => {
    const a = box("a", [1, 2, 3], [0, 20, 0]);
    const patches = transformSelection([a], [1, 2, 3], new THREE.Quaternion(), 1);
    expect(patches).toEqual([]);
  });

  it("reads a yaw back out of a rotation the way a door and a Foamer do", () => {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -90 * DEG, 0, "XYZ"));
    expect(yawOf(q)).toBeCloseTo(270 * DEG, 5);
  });
});
