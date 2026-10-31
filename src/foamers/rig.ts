import * as THREE from "three";
import { VoxelVolume } from "../voxel/chunk";
import { materialId } from "../voxel/materials";

// Foamer rigs: a Foamer is a few voxel parts (body, head, arms, legs and
// ability parts) on a simple skeleton (PLAN.md 7.3 point 6). This file
// builds each part's voxels from a primitive shape and solves the pose of
// every part from the root and the joint rotations. Used by the sandbox
// (sandbox.html) now and by the game's Foamers in ENG-10.

export type PartShape = "ellipsoid" | "capsule" | "box" | "cylinder" | "cone" | "tube" | "disc";
export type PartKind = "body" | "head" | "arm" | "leg" | "fin" | "ability" | "weapon" | "detail";
export type EyeStyle = "round" | "angry" | "slit";

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
  /** Radius scale at the bottom and top (along y) of an ellipsoid,
   *  capsule, cylinder, cone or tube. Default [1, 1]; a cone defaults to
   *  [1, 0.15]. */
  taper?: [number, number];
  /** Rounded spikes out of an ellipsoid, one per direction (box
   *  coordinates). The ellipsoid shrinks to make room inside the box. */
  nubs?: [number, number, number][];
  /** Two eyes on the +z face. true means "round". */
  eyes?: boolean | EyeStyle;
  /** A toothless mouth on the +z face, under the eyes: a painted grin, or
   *  a gaping hole (ellipsoids only; others get it painted). */
  mouth?: "grin" | "gape";
  /** Paint the bottom `length` voxels (the muzzle of a barrel that hangs
   *  from its pivot) another material. */
  tip?: { material: string; length: number };
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

/** Spikes take up the outer part of the box: the ellipsoid keeps this much. */
const NUB_CORE = 0.55;

/** Fill voxels 0..size-1 of one part. */
export function buildPartVolume(volume: VoxelVolume, part: PartSpec, rigMaterial: string): void {
  const [sx, sy, sz] = part.size;
  const m = materialId(part.material ?? rigMaterial);
  const white = materialId("foam-white");
  const ink = materialId("foam-ink");
  const tipMat = part.tip ? materialId(part.tip.material) : 0;
  const cx = (sx - 1) / 2, cy = (sy - 1) / 2, cz = (sz - 1) / 2;
  const rx = sx / 2, ry = sy / 2, rz = sz / 2;
  const taper = part.taper ?? (part.shape === "cone" ? [1, 0.15] : [1, 1]);
  const nubs = (part.nubs ?? []).map(([a, b, c]) => {
    const l = Math.hypot(a, b, c) || 1;
    return [a / l, b / l, c / l];
  });

  const inside = (x: number, y: number, z: number): boolean => {
    if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) return false;
    const dx = (x - cx) / rx, dy = (y - cy) / ry, dz = (z - cz) / rz;
    // Radius scale along y for the round shapes that taper.
    const ty = taper[0] + (taper[1] - taper[0]) * (sy > 1 ? y / (sy - 1) : 0);
    switch (part.shape) {
      case "ellipsoid": {
        const core = nubs.length ? NUB_CORE : 1;
        const ex = dx / ty, ez = dz / ty;
        const d2 = ex * ex + dy * dy + ez * ez;
        if (d2 <= core * core || (!!part.flatBottom && y < 2 && ex * ex + ez * ez <= core * core)) return true;
        for (const [a, b, c] of nubs) {
          const t = dx * a + dy * b + dz * c;
          if (t <= 0 || t > 1) continue;
          const px = dx - t * a, py = dy - t * b, pz = dz - t * c;
          if (px * px + py * py + pz * pz <= ((1 - t) * 0.8) ** 2) return true;
        }
        return false;
      }
      case "capsule": {
        // Along y: a cylinder with half-sphere ends of the box's radius.
        const r = Math.min(rx, rz) * ty;
        const ey = Math.max(0, Math.abs(y - cy) - (ry - Math.min(rx, rz)));
        return ((x - cx) / r) ** 2 + ((z - cz) / r) ** 2 + (ey / r) ** 2 <= 1;
      }
      case "box":
        return true;
      case "cylinder":
      case "cone":
        return (dx / ty) ** 2 + (dz / ty) ** 2 <= 1;
      case "tube": {
        // A barrel along y, open at both ends, walls at least 1 voxel.
        const d2 = (dx / ty) ** 2 + (dz / ty) ** 2;
        const hole = 1 - Math.max(1.2, Math.min(rx, rz) * ty * 0.4) / (Math.min(rx, rz) * ty);
        return d2 <= 1 && d2 > hole * hole;
      }
      case "disc":
        // A round plate facing +z.
        return dx * dx + dy * dy <= 1;
    }
  };

  // Face details, painted on the voxels of the +z surface. Eyes are at
  // least 3 voxels wide so they read as round, capped at 3 so big Foamers
  // get eyes of a readable size, not saucers.
  const eyes: EyeStyle | null = part.eyes === true ? "round" : part.eyes || null;
  const eyeR = Math.min(3, Math.max(1.5, Math.min(sx / 6, sy / 4))) * (eyes === "slit" ? 1.3 : 1);
  const eyeY = cy + sy * 0.12;
  const eyeXs = [cx - sx * 0.2, cx + sx * 0.2];
  const eyeAt = (x: number, y: number): number => {
    for (const ex of eyeXs) {
      const fy = eyes === "slit" ? 2.5 : 1;
      const d2 = (x - ex) ** 2 + ((y - eyeY) * fy) ** 2;
      if (d2 > eyeR * eyeR) continue;
      // Angry: a heavy lid slanting down toward the middle of the face.
      if (eyes === "angry") {
        const toMid = (cx - ex) > 0 ? x - ex : ex - x;
        if (y - eyeY > eyeR * 0.3 - toMid * 0.7) return 0;
      }
      const pupil = eyes === "angry" ? 0.45 : 0.5;
      return d2 <= (eyeR * pupil) ** 2 ? ink : white;
    }
    return 0;
  };
  const mouthY = cy - sy * 0.22, mouthW = sx * 0.26, mouthH = Math.max(1.5, sy * 0.13);
  const inMouth = (x: number, y: number): boolean => {
    if (!part.mouth || Math.abs(x - cx) > mouthW) return false;
    if (part.mouth === "grin") {
      // A wide band whose corners turn up.
      const curve = sy * 0.08 * ((x - cx) / mouthW) ** 2;
      return Math.abs(y - (mouthY + curve)) <= 1.1;
    }
    return ((x - cx) / mouthW) ** 2 + ((y - mouthY) / mouthH) ** 2 <= 1;
  };
  const gape = part.mouth === "gape" && part.shape === "ellipsoid";

  for (let y = 0; y < sy; y++)
    for (let x = 0; x < sx; x++) {
      // Front surface depth of this column, for the gaping mouth.
      let zf = -1;
      if (gape) for (let z = sz - 1; z >= 0; z--) if (inside(x, y, z)) { zf = z; break; }
      for (let z = 0; z < sz; z++) {
        if (!inside(x, y, z)) continue;
        let mat = m;
        if (tipMat && y < part.tip!.length) mat = tipMat;
        if (gape && inMouth(x, y) && z >= cz) {
          if (z > zf - 2) continue; // the open mouth
          if (z > zf - 4) mat = ink; // its back wall
        } else if (z >= cz && !inside(x, y, z + 1)) {
          if (eyes) mat = eyeAt(x, y) || mat;
          if (part.mouth === "grin" && inMouth(x, y)) mat = ink;
        }
        volume.set(x, y, z, mat);
      }
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
