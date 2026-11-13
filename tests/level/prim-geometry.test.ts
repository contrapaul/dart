import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { Prim } from "../../src/level/format";
import { primColliderParts, primContains, primGeometry, primMatrix, stairSteps } from "../../src/level/prim-geometry";

const prim = (shape: Prim["shape"], extra: Partial<Prim> = {}): Prim => ({
  id: "p", shape, pos: [0, 0, 0], size: [2, 2, 2], colour: "#ffffff", behaviour: "solid", ...extra,
});

function bounds(p: Prim) {
  const g = primGeometry(p);
  g.computeBoundingBox();
  return g.boundingBox!;
}

describe("ED-00 prim geometry", () => {
  it("every shape fills its size box", () => {
    for (const s of ["box", "ramp", "wedge", "cylinder", "stairs"] as const) {
      const b = bounds(prim(s, { size: [2, 3, 4], steps: 4 }));
      expect(b.min.toArray().map((n) => +n.toFixed(5))).toEqual([-1, -1.5, -2]);
      expect(b.max.toArray().map((n) => +n.toFixed(5))).toEqual([1, 1.5, 2]);
    }
  });

  it("prism faces point outward", () => {
    for (const s of ["ramp", "wedge"] as const) {
      const g = primGeometry(prim(s));
      const pos = g.getAttribute("position");
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      for (let i = 0; i < pos.count; i += 3) {
        a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
        const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
        const mid = new THREE.Vector3().addVectors(a, b).add(c).divideScalar(3);
        // The prism's centroid is inside; a face's normal points away from it.
        const centroid = s === "ramp" ? new THREE.Vector3(0, -1 / 3, 1 / 3) : new THREE.Vector3(0, -1 / 3, 0);
        expect(n.dot(mid.sub(centroid))).toBeGreaterThan(0);
      }
    }
  });

  it("stairs rise along +z to the full height", () => {
    const s = stairSteps([2, 3, 6], 3);
    expect(s.map((x) => x.size[1])).toEqual([1, 2, 3]);
    expect(s.map((x) => x.centre[2])).toEqual([-2, 0, 2]);
    expect(primColliderParts(prim("stairs", { steps: 3 }))).toHaveLength(3);
  });

  it("contains follows the shape and the transform", () => {
    const lake = prim("box", { pos: [10, 0, 0], size: [8, 1, 8], rot: [0, 45, 0] });
    const inv = primMatrix(lake).invert();
    expect(primContains(lake, inv, new THREE.Vector3(10, 0, 0))).toBe(true);
    expect(primContains(lake, inv, new THREE.Vector3(14.5, 0, 0))).toBe(true); // a 45 degree corner reaches 5.66
    expect(primContains(lake, inv, new THREE.Vector3(10, 1, 0))).toBe(false);
    const ramp = prim("ramp");
    const rinv = primMatrix(ramp).invert();
    expect(primContains(ramp, rinv, new THREE.Vector3(0, 0.5, 0.9))).toBe(true);
    expect(primContains(ramp, rinv, new THREE.Vector3(0, 0.5, -0.9))).toBe(false);
    const cyl = prim("cylinder");
    const cinv = primMatrix(cyl).invert();
    expect(primContains(cyl, cinv, new THREE.Vector3(0.95, 0, 0.95))).toBe(false);
  });
});
