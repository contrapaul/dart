import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { faceCentre, resizeFace, sizeText, type Resizable } from "../../src/editor/resize";

// ED-14: dragging one face of a box moves that face and leaves the opposite
// one where it is. The handles and the drag are checked in the browser.

const DEG = Math.PI / 180;

/** The world point at the middle of a face, worked out the long way. */
function face(box: Resizable, axis: 0 | 1 | 2, side: 1 | -1): THREE.Vector3 {
  const r = box.rot ?? [0, 0, 0];
  const local = new THREE.Vector3();
  local.setComponent(axis, (side * box.size[axis]) / 2);
  return local
    .applyEuler(new THREE.Euler(r[0] * DEG, r[1] * DEG, r[2] * DEG, "XYZ"))
    .add(new THREE.Vector3(...box.pos));
}

const plain: Resizable = { pos: [1, 2, 3], size: [4, 2, 6] };

describe("ED-14 drag a face to resize", () => {
  const faces: [0 | 1 | 2, 1 | -1][] = [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]];

  it.each(faces)("axis %i side %i: that face moves, the opposite one stays", (axis, side) => {
    const next = resizeFace(plain, axis, side, 2, 0.5, 0.5);
    expect(next.size[axis]).toBe(plain.size[axis] + 2);
    for (const other of [0, 1, 2]) if (other !== axis) expect(next.size[other]).toBe(plain.size[other]);
    const made: Resizable = { ...plain, ...next };
    const opposite = (side * -1) as 1 | -1;
    expect(face(made, axis, opposite).distanceTo(face(plain, axis, opposite))).toBeLessThan(1e-6);
    expect(face(made, axis, side).distanceTo(face(plain, axis, side))).toBeCloseTo(2, 6);
  });

  it.each([90, 30])("a box turned %i degrees keeps its opposite face fixed", (deg) => {
    const turned: Resizable = { pos: [1, 2, 3], size: [4, 2, 6], rot: [0, deg, 0] };
    const next = resizeFace(turned, 2, 1, 3, 0.5, 0.5);
    const made: Resizable = { ...turned, ...next };
    expect(next.size).toEqual([4, 2, 9]);
    expect(face(made, 2, -1).distanceTo(face(turned, 2, -1))).toBeLessThan(1e-3);
    expect(face(made, 2, 1).distanceTo(face(turned, 2, 1))).toBeCloseTo(3, 3);
  });

  it("holds for a box tipped on two axes, like a converted ramp", () => {
    const tipped: Resizable = { pos: [0, 5, 0], size: [6, 4, 8.0623], rot: [-29.7449, 90, 0] };
    const next = resizeFace(tipped, 0, -1, 1.5, 0.5, 0.5);
    const made: Resizable = { ...tipped, ...next };
    expect(face(made, 0, 1).distanceTo(face(tipped, 0, 1))).toBeLessThan(1e-3);
  });

  it("pushing in shrinks it, but never under the smallest size", () => {
    expect(resizeFace(plain, 0, 1, -1, 0.5, 0.5).size[0]).toBe(3);
    const tiny = resizeFace(plain, 0, 1, -50, 0.5, 0.5);
    expect(tiny.size[0]).toBe(0.5);
    // The far face is still where it was.
    expect(tiny.pos[0] - tiny.size[0] / 2).toBeCloseTo(plain.pos[0] - plain.size[0] / 2, 6);
  });

  it("snaps the size when snap is on and takes it as dragged when off", () => {
    expect(resizeFace(plain, 0, 1, 0.7, 0.5, 0.5).size[0]).toBe(4.5);
    expect(resizeFace(plain, 0, 1, 0.7, 0, 0.5).size[0]).toBeCloseTo(4.7, 6);
  });

  it("only the dragged axis is snapped", () => {
    const odd: Resizable = { pos: [0, 0.4, 0], size: [1, 0.8, 1.4] };
    const next = resizeFace(odd, 0, 1, 1, 0.5, 0.5);
    expect(next.size).toEqual([2, 0.8, 1.4]);
    expect(next.pos[1]).toBe(0.4);
  });

  it("does not change the box it was given", () => {
    const before = JSON.stringify(plain);
    resizeFace(plain, 1, 1, 3, 0.5, 0.5);
    expect(JSON.stringify(plain)).toBe(before);
  });

  it("finds the middle of a face", () => {
    const c = faceCentre({ pos: [1, 2, 3], size: [4, 2, 6], rot: [0, 90, 0] }, 2, 1);
    // Local +z turned a quarter turn about the vertical points along +x.
    expect(c[0]).toBeCloseTo(4, 6);
    expect(c[1]).toBeCloseTo(2, 6);
    expect(c[2]).toBeCloseTo(3, 6);
  });

  it("writes a size as metres", () => {
    expect(sizeText([6.5, 3, 0.5])).toBe("6.5 x 3 x 0.5");
    expect(sizeText([1.23456, 2, 2])).toBe("1.23 x 2 x 2");
  });
});
