import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Prim, Vec3 } from "./format";

// ED-00: the one place the five primitive shapes are defined, so the editor,
// the game's builder, hazards and the validator all agree on what a prim
// covers. Every shape fills its size box, centred on the origin, before the
// prim's rotation and position (`primMatrix`). Shapes are described in
// src/level/format.ts (PrimShape).

const DEG = Math.PI / 180;
const CYLINDER_SEGMENTS = 24;

/** The prim's local to world transform: scale is already in the geometry,
 *  so this is rotation (degrees, XYZ) then position. */
export function primMatrix(prim: Prim, out = new THREE.Matrix4()): THREE.Matrix4 {
  const r = prim.rot ?? [0, 0, 0];
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0] * DEG, r[1] * DEG, r[2] * DEG, "XYZ"));
  return out.compose(new THREE.Vector3(...prim.pos), q, new THREE.Vector3(1, 1, 1));
}

/** A step of the stairs, in local metres: centre and full size. */
export function stairSteps(size: Vec3, steps: number): { centre: Vec3; size: Vec3 }[] {
  const [sx, sy, sz] = size;
  const n = Math.max(1, Math.floor(steps));
  const out: { centre: Vec3; size: Vec3 }[] = [];
  for (let i = 0; i < n; i++) {
    const h = (sy * (i + 1)) / n;
    const d = sz / n;
    out.push({ centre: [0, -sy / 2 + h / 2, -sz / 2 + d * (i + 0.5)], size: [sx, h, d] });
  }
  return out;
}

/** The corners of a ramp or wedge in local metres (six points, a prism). */
export function prismPoints(prim: Prim): Vec3[] {
  const [hx, hy, hz] = [prim.size[0] / 2, prim.size[1] / 2, prim.size[2] / 2];
  if (prim.shape === "ramp") {
    // The triangle across z (low at -z, high at +z), extruded along x.
    const tri: [number, number][] = [[-hz, -hy], [hz, -hy], [hz, hy]];
    return [-hx, hx].flatMap((x) => tri.map(([z, y]) => [x, y, z] as Vec3));
  }
  // wedge: the triangle across x with the ridge at the top centre, along z.
  const tri: [number, number][] = [[-hx, -hy], [hx, -hy], [0, hy]];
  return [-hz, hz].flatMap((z) => tri.map(([x, y]) => [x, y, z] as Vec3));
}

/** The convex pieces a collider is built from, in local metres. A box and
 *  each stair step is a cuboid; a ramp, a wedge and a cylinder are convex
 *  hulls of their points (a cylinder may be oval, so it is not a Rapier
 *  cylinder). */
export type ColliderPart =
  | { kind: "cuboid"; centre: Vec3; half: Vec3 }
  | { kind: "hull"; points: Float32Array };

export function primColliderParts(prim: Prim): ColliderPart[] {
  const [sx, sy, sz] = prim.size;
  switch (prim.shape) {
    case "box":
      return [{ kind: "cuboid", centre: [0, 0, 0], half: [sx / 2, sy / 2, sz / 2] }];
    case "stairs":
      return stairSteps(prim.size, prim.steps ?? 2).map((s) => ({
        kind: "cuboid", centre: s.centre, half: [s.size[0] / 2, s.size[1] / 2, s.size[2] / 2],
      }));
    case "ramp":
    case "wedge":
      return [{ kind: "hull", points: new Float32Array(prismPoints(prim).flat()) }];
    case "cylinder": {
      const pts: number[] = [];
      for (let i = 0; i < CYLINDER_SEGMENTS; i++) {
        const a = (i / CYLINDER_SEGMENTS) * Math.PI * 2;
        const x = (Math.cos(a) * sx) / 2, z = (Math.sin(a) * sz) / 2;
        pts.push(x, -sy / 2, z, x, sy / 2, z);
      }
      return [{ kind: "hull", points: new Float32Array(pts) }];
    }
  }
}

function prismGeometry(prim: Prim): THREE.BufferGeometry {
  const p = prismPoints(prim).map((v) => new THREE.Vector3(...v));
  // 0 1 2 is one end triangle, 3 4 5 the other; quads join edge to edge.
  const faces: number[][] = [[0, 2, 1], [3, 4, 5], [0, 1, 4, 3], [1, 2, 5, 4], [2, 0, 3, 5]];
  const pos: number[] = [];
  const centre = p.reduce((a, v) => a.add(v), new THREE.Vector3()).divideScalar(p.length);
  for (const f of faces) {
    const tris = f.length === 3 ? [f] : [[f[0], f[1], f[2]], [f[0], f[2], f[3]]];
    for (const t of tris) {
      const [a, b, c] = t.map((i) => p[i]);
      // Wind each triangle outward, whatever order the face was listed in.
      const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
      const out = new THREE.Vector3().addVectors(a, b).add(c).divideScalar(3).sub(centre);
      const order = n.dot(out) >= 0 ? [a, b, c] : [a, c, b];
      for (const v of order) pos.push(v.x, v.y, v.z);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** The prim's geometry in local metres (size applied, no rotation or
 *  position). The caller owns it and disposes it. */
export function primGeometry(prim: Prim): THREE.BufferGeometry {
  const [sx, sy, sz] = prim.size;
  switch (prim.shape) {
    case "box":
      return new THREE.BoxGeometry(sx, sy, sz);
    case "cylinder":
      return new THREE.CylinderGeometry(0.5, 0.5, 1, CYLINDER_SEGMENTS).scale(sx, sy, sz);
    case "ramp":
    case "wedge":
      return prismGeometry(prim);
    case "stairs": {
      const parts = stairSteps(prim.size, prim.steps ?? 2).map((s) =>
        new THREE.BoxGeometry(...s.size).translate(...s.centre));
      const merged = mergeGeometries(parts)!;
      for (const p of parts) p.dispose();
      return merged;
    }
  }
}

/** True when a world point is inside the prim's shape (used for hazards:
 *  is the player or a Foamer in the lake). `inverse` is the inverse of
 *  `primMatrix(prim)`, cached by the caller. */
export function primContains(prim: Prim, inverse: THREE.Matrix4, point: THREE.Vector3): boolean {
  const p = point.clone().applyMatrix4(inverse);
  const [hx, hy, hz] = [prim.size[0] / 2, prim.size[1] / 2, prim.size[2] / 2];
  if (Math.abs(p.x) > hx || Math.abs(p.y) > hy || Math.abs(p.z) > hz) return false;
  switch (prim.shape) {
    case "box":
      return true;
    case "cylinder":
      return (p.x / hx) ** 2 + (p.z / hz) ** 2 <= 1;
    case "ramp":
      // The top rises from -hy at -z to hy at +z.
      return p.y <= -hy + ((p.z + hz) / (2 * hz)) * 2 * hy;
    case "wedge":
      return p.y <= hy - (Math.abs(p.x) / hx) * 2 * hy;
    case "stairs": {
      const n = Math.max(1, Math.floor(prim.steps ?? 2));
      const i = Math.min(n - 1, Math.floor(((p.z + hz) / (2 * hz)) * n));
      return p.y <= -hy + ((2 * hy) * (i + 1)) / n;
    }
  }
}
