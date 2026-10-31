import * as THREE from "three";
import { VoxelVolume } from "../voxel/chunk";
import { materialId } from "../voxel/materials";

// Foamer rigs: a Foamer is a few voxel parts (body, head, arms, legs and
// ability parts) on a simple skeleton (PLAN.md 7.3 point 6). This file
// builds each part's voxels from a primitive shape and solves the pose of
// every part from the root and the joint rotations. Used by the sandbox
// (sandbox.html) now and by the game's Foamers in ENG-10.

export type PartShape = "ellipsoid" | "capsule" | "box" | "cylinder" | "disc";
export type PartKind = "body" | "head" | "arm" | "leg" | "fin" | "ability";

export interface PartSpec {
  id: string;
  kind: PartKind;
  shape: PartShape;
  /** Size of the part's voxel box. Parts must fit one chunk (32). */
  size: [number, number, number];
  /** null only for the root part (the body). */
  parent: string | null;
  /** Where the joint sits on the parent's box: -1 to 1 per axis, 0 is the
   *  centre, 1 the +x / top / front face. Unused for the root part. */
  at?: [number, number, number];
  /** Where the joint sits on this part's own box (-1 to 1). Default: the
   *  top centre, which suits arms and legs. */
  pivot?: [number, number, number];
  /** Rest rotation about the joint, radians (x, y, z). */
  rest?: [number, number, number];
  /** Flatten the bottom of an ellipsoid so it sits flat. */
  flatBottom?: boolean;
  /** Two eyes on the +z face. */
  eyes?: boolean;
  /** Voxel material name; default from the rig. */
  material?: string;
}

export interface RigSpec {
  id: string;
  label: string;
  tier: string;
  behaviour: string;
  movement: string;
  /** Ground speed in m/s while moving. */
  speed: number;
  /** How many walk together (a pack). */
  pack?: number;
  /** Extra height for flyers and floaters, metres. */
  hover?: number;
  voxelSize: number;
  material: string;
  parts: PartSpec[];
}

/** Joint rotations by part id, plus root motion, for one moment. */
export interface RigMotion {
  /** Root lift (bob, jumps), metres. */
  y: number;
  /** Root lean: pitch (x) and roll (z), radians. */
  pitch: number;
  roll: number;
  /** Per part extra rotation about its joint, radians. */
  rot: Map<string, [number, number, number]>;
  /** Squash and stretch of the whole rig in y (1 = none). */
  squash: number;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();

/** Fill voxels 0..size-1 of one part. */
export function buildPartVolume(volume: VoxelVolume, part: PartSpec, rigMaterial: string): void {
  const [sx, sy, sz] = part.size;
  const m = materialId(part.material ?? rigMaterial);
  const white = materialId("foam-white");
  const ink = materialId("foam-ink");
  const cx = (sx - 1) / 2, cy = (sy - 1) / 2, cz = (sz - 1) / 2;
  const rx = sx / 2, ry = sy / 2, rz = sz / 2;
  // Eyes: two discs on the +z face, at least 3 voxels wide so smoothing
  // keeps them (ENG-09), with a pupil half as wide.
  // Capped at 3, so big Foamers get eyes of a readable size, not saucers.
  const eyeR = Math.min(3, Math.max(1.5, Math.min(sx / 6, sy / 4)));
  const eyeY = cy + sy * 0.12;
  const eyeXs = [cx - sx * 0.2, cx + sx * 0.2];
  for (let y = 0; y < sy; y++)
    for (let z = 0; z < sz; z++)
      for (let x = 0; x < sx; x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry, dz = (z - cz) / rz;
        let inside = false;
        switch (part.shape) {
          case "ellipsoid":
            inside = dx * dx + dy * dy + dz * dz <= 1 || (!!part.flatBottom && y < 2 && dx * dx + dz * dz <= 1);
            break;
          case "capsule": {
            // Along y: a cylinder with half-sphere ends of the box's radius.
            const r = Math.min(rx, rz);
            const ey = Math.max(0, Math.abs(y - cy) - (ry - r));
            inside = ((x - cx) / r) ** 2 + ((z - cz) / r) ** 2 + (ey / r) ** 2 <= 1;
            break;
          }
          case "box":
            inside = true;
            break;
          case "cylinder":
            inside = dx * dx + dz * dz <= 1;
            break;
          case "disc":
            // A round plate facing +z.
            inside = dx * dx + dy * dy <= 1;
            break;
        }
        if (!inside) continue;
        let mat = m;
        if (part.eyes && z >= cz) {
          // Only the voxels on the front surface get painted.
          const front = z + 1 >= sz || (() => {
            const ndz = (z + 1 - cz) / rz;
            return dx * dx + dy * dy + ndz * ndz > 1;
          })();
          if (front)
            for (const ex of eyeXs) {
              const d2 = (x - ex) ** 2 + (y - eyeY) ** 2;
              if (d2 <= eyeR * eyeR) mat = white;
              if (d2 <= (eyeR * 0.5) ** 2) mat = ink;
            }
        }
        volume.set(x, y, z, mat);
      }
}

/** Point on a box of `size` voxels given -1..1 coordinates, in metres from
 *  its (0,0,0) corner. */
function boxPoint(size: [number, number, number], at: [number, number, number], vs: number, out: THREE.Vector3) {
  return out.set(((at[0] + 1) / 2) * size[0] * vs, ((at[1] + 1) / 2) * size[1] * vs, ((at[2] + 1) / 2) * size[2] * vs);
}

/** Parts in an order where every parent comes before its children. */
export function partOrder(rig: RigSpec): PartSpec[] {
  const out: PartSpec[] = [];
  const done = new Set<string>();
  while (out.length < rig.parts.length) {
    const before = out.length;
    for (const p of rig.parts)
      if (!done.has(p.id) && (p.parent === null || done.has(p.parent))) {
        out.push(p);
        done.add(p.id);
      }
    if (out.length === before) throw new Error(`rig ${rig.id}: a part has a missing parent`);
  }
  return out;
}

/**
 * World matrix of every part's voxel corner (its volume's (0,0,0)), for a
 * root at `feet` turned by `yaw`, posed by `motion`. A part's voxels map to
 * the world as corner matrix x (voxel coordinates x voxelSize).
 */
export function solvePose(
  rig: RigSpec,
  feet: THREE.Vector3,
  yaw: number,
  motion: RigMotion,
  out: Map<string, THREE.Matrix4>,
): Map<string, THREE.Matrix4> {
  return solveRaw(rig, feet, yaw, motion, out, (rig.hover ?? 0) - groundOffset(rig));
}

const groundCache = new WeakMap<RigSpec, number>();
/** Lowest point of the rig at rest with its root at 0: subtracting it puts
 *  the feet on the ground, whatever the proportions. */
function groundOffset(rig: RigSpec): number {
  let low = groundCache.get(rig);
  if (low !== undefined) return low;
  const pose = solveRaw(rig, new THREE.Vector3(), 0, restMotion(), new Map(), 0);
  low = Infinity;
  for (const p of rig.parts) {
    const m = pose.get(p.id)!;
    for (const cx of [0, 1]) for (const cy of [0, 1]) for (const cz of [0, 1]) {
      _v.set(cx * p.size[0], cy * p.size[1], cz * p.size[2]).multiplyScalar(rig.voxelSize).applyMatrix4(m);
      low = Math.min(low, _v.y);
    }
  }
  groundCache.set(rig, low);
  return low;
}

function solveRaw(
  rig: RigSpec,
  feet: THREE.Vector3,
  yaw: number,
  motion: RigMotion,
  out: Map<string, THREE.Matrix4>,
  lift: number,
): Map<string, THREE.Matrix4> {
  const vs = rig.voxelSize;
  const root = new THREE.Matrix4()
    .makeTranslation(feet.x, feet.y + lift + motion.y, feet.z)
    .multiply(_m.makeRotationY(yaw))
    .multiply(_m.makeRotationFromEuler(_e.set(motion.pitch, 0, motion.roll)))
    .multiply(_m.makeScale(1 / Math.sqrt(motion.squash), motion.squash, 1 / Math.sqrt(motion.squash)));
  for (const p of partOrder(rig)) {
    const mat = out.get(p.id) ?? new THREE.Matrix4();
    // Joint point in the parent's frame.
    if (p.parent === null) {
      mat.copy(root);
    } else {
      const parent = rig.parts.find((q) => q.id === p.parent)!;
      boxPoint(parent.size, p.at ?? [0, 0, 0], vs, _v);
      mat.copy(out.get(p.parent)!).multiply(_m.makeTranslation(_v.x, _v.y, _v.z));
    }
    const rest = p.rest ?? [0, 0, 0];
    const extra = motion.rot.get(p.id) ?? [0, 0, 0];
    _q.setFromEuler(_e.set(rest[0], rest[1], rest[2])).multiply(
      new THREE.Quaternion().setFromEuler(_e.set(extra[0], extra[1], extra[2])),
    );
    mat.multiply(_m.makeRotationFromQuaternion(_q));
    // Move so this part's pivot sits on the joint.
    boxPoint(p.size, p.pivot ?? (p.parent === null ? [0, -1, 0] : [0, 1, 0]), vs, _v);
    mat.multiply(_m.makeTranslation(-_v.x, -_v.y, -_v.z));
    out.set(p.id, mat);
  }
  return out;
}

/** A still pose: no motion. */
export function restMotion(): RigMotion {
  return { y: 0, pitch: 0, roll: 0, rot: new Map(), squash: 1 };
}

/** Height of the rig at rest, metres: the top of the highest part. */
export function rigHeight(rig: RigSpec): number {
  const pose = solvePose(rig, new THREE.Vector3(), 0, restMotion(), new Map());
  let top = 0;
  for (const p of rig.parts) {
    const m = pose.get(p.id)!;
    for (const cx of [0, 1]) for (const cy of [0, 1]) for (const cz of [0, 1]) {
      _v.set(cx * p.size[0], cy * p.size[1], cz * p.size[2]).multiplyScalar(rig.voxelSize).applyMatrix4(m);
      top = Math.max(top, _v.y);
    }
  }
  return top;
}
