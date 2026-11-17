import * as THREE from "three";
import type { Vec3 } from "../level/format";
import { snapValue } from "./doc";

// ED-14: the maths of dragging one face of a box. A prim, a zone, a door and
// the exit are all a centre, a size and a turn, so one function serves them.
// No DOM: the handles are in src/editor/view.ts and the drag in main.ts.

const DEG = Math.PI / 180;

/** What a face drag needs of a thing: its centre, its size, and its turn in
 *  degrees (XYZ order, as a prim's `rot`). */
export interface Resizable {
  pos: Vec3;
  size: Vec3;
  rot?: Vec3;
}

function tidy(n: number): number {
  const r = Math.round(n * 1e4) / 1e4;
  return r === 0 ? 0 : r;
}

/** The thing's own axis in the world, pointing out of the face on `side`. */
export function faceDirection(box: Resizable, axis: 0 | 1 | 2, side: 1 | -1): THREE.Vector3 {
  const r = box.rot ?? [0, 0, 0];
  const dir = new THREE.Vector3();
  dir.setComponent(axis, side);
  return dir.applyEuler(new THREE.Euler(r[0] * DEG, r[1] * DEG, r[2] * DEG, "XYZ"));
}

/** The middle of a face, in the world. */
export function faceCentre(box: Resizable, axis: 0 | 1 | 2, side: 1 | -1): Vec3 {
  const c = faceDirection(box, axis, side).multiplyScalar(box.size[axis] / 2).add(new THREE.Vector3(...box.pos));
  return [c.x, c.y, c.z];
}

/** The place and size after the face on `side` of `axis` is pulled out by
 *  `metres` (pushed in when negative). The opposite face stays where it is.
 *  The new size is snapped to `grid` when it is above zero, and is never
 *  under `min`. Only the dragged axis changes. */
export function resizeFace(
  box: Resizable, axis: 0 | 1 | 2, side: 1 | -1, metres: number, grid: number, min: number,
): { pos: Vec3; size: Vec3 } {
  const length = Math.max(min, snapValue(box.size[axis] + metres, grid));
  const grown = length - box.size[axis];
  const size: Vec3 = [box.size[0], box.size[1], box.size[2]];
  size[axis] = tidy(length);
  // The centre moves half the growth toward the dragged face.
  const shift = faceDirection(box, axis, side).multiplyScalar(grown / 2);
  const pos: Vec3 = [box.pos[0], box.pos[1], box.pos[2]];
  if (grown !== 0) {
    pos[0] = tidy(pos[0] + shift.x);
    pos[1] = tidy(pos[1] + shift.y);
    pos[2] = tidy(pos[2] + shift.z);
  }
  return { pos, size };
}

/** A size as the label shows it: metres, two decimals at most. */
export function sizeText(size: Vec3): string {
  return size.map((n) => String(Math.round(n * 100) / 100)).join(" x ");
}
