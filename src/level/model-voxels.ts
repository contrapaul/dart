import * as THREE from "three";
import { modelTriangles } from "./models";
import type { PieceVolume, Vec3 } from "./format";

// ED-35: a model that breaks as voxel foam. Its inside is found by the
// standard parity test: a ray from the voxel centre along +X crosses the
// model's triangles an odd number of times when the centre is inside. The
// inside voxels become piece volumes of at most 3.2 m a side, the size a
// voxel piece may be (design/EDITOR.md section 7), so the model carves like
// a foam wall.
//
// Pure data: no Rapier and no page, so the parity test is tested headless.

/** design/EDITOR.md section 7: no voxel piece volume is longer than this. */
export const MAX_MODEL_VOLUME = 3.2;
export const MODEL_VOXEL = 0.1;

/** Whether a +X ray from `p` crosses one triangle of the mesh. Moller and
 *  Trumbore with the direction fixed at +X, which saves the cross products
 *  of the general form. */
function crossesX(
  vertices: Float32Array, a: number, b: number, c: number, px: number, py: number, pz: number,
): boolean {
  const e1x = vertices[b]! - vertices[a]!, e1y = vertices[b + 1]! - vertices[a + 1]!, e1z = vertices[b + 2]! - vertices[a + 2]!;
  const e2x = vertices[c]! - vertices[a]!, e2y = vertices[c + 1]! - vertices[a + 1]!, e2z = vertices[c + 2]! - vertices[a + 2]!;
  const det = e1z * e2y - e1y * e2z;
  if (Math.abs(det) < 1e-12) return false;
  const inv = 1 / det;
  const tx = px - vertices[a]!, ty = py - vertices[a + 1]!, tz = pz - vertices[a + 2]!;
  const u = (tz * e2y - ty * e2z) * inv;
  if (u < 0 || u > 1) return false;
  const qx = ty * e1z - tz * e1y;
  const qy = tz * e1x - tx * e1z;
  const qz = tx * e1y - ty * e1x;
  const v = qx * inv;
  if (v < 0 || u + v > 1) return false;
  const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return t > 1e-6;
}

/** The parity test for one point: odd crossings is inside. The point is
 *  moved a hair off the axis planes, so a ray that grazes an edge does not
 *  count one triangle of the pair and miss the other. The two offsets
 *  differ so the ray never runs along a face's diagonal either. */
export function insideModel(vertices: Float32Array, indices: Uint32Array, p: THREE.Vector3): boolean {
  const px = p.x, py = p.y + 1e-5, pz = p.z + 2.7e-5;
  let crossings = 0;
  for (let i = 0; i < indices.length; i += 3) {
    if (crossesX(vertices, indices[i]! * 3, indices[i + 1]! * 3, indices[i + 2]! * 3, px, py, pz)) crossings++;
  }
  return (crossings & 1) === 1;
}

export interface ModelVoxels {
  /** Voxel centres inside the model. */
  count: number;
  /** The occupied voxels as boxes, each at most 3.2 m a side. */
  volumes: PieceVolume[];
  /** True when the model was over the cap: nothing was filled and the
   *  caller builds it by hit points instead. */
  capped: boolean;
}

/** The principal colour of a loaded model: the first mesh material's colour,
 *  so the foam a breakable model bursts into looks like the model. */
export function mainColour(object: THREE.Object3D): string {
  let found: string | null = null;
  object.traverse((child) => {
    if (found) return;
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const colour = (material as THREE.MeshStandardMaterial | undefined)?.color;
    if (colour) found = `#${colour.getHexString()}`;
  });
  return found ?? "#f4ecdc";
}

/** The voxel cells a run spans, as a box centred on them. */
function boxOf(lo: Vec3, cells: Vec3, voxel: number, material: string): PieceVolume {
  const pos: Vec3 = [
    lo[0]! + (cells[0]! * voxel) / 2,
    lo[1]! + (cells[1]! * voxel) / 2,
    lo[2]! + (cells[2]! * voxel) / 2,
  ];
  return { pos, size: [cells[0]! * voxel, cells[1]! * voxel, cells[2]! * voxel], material };
}

/** Fills a loaded, placed model with voxel foam: every 0.1 m centre inside
 *  its world bounds that the parity test finds inside becomes foam, greedy
 *  merged into boxes of at most 3.2 m a side. Over `maxVoxels` inside, the
 *  model is refused (`capped`) and the caller uses hit points. */
export function modelVoxelVolumes(
  object: THREE.Object3D, material: string, maxVoxels = Infinity, voxel = MODEL_VOXEL,
): ModelVoxels {
  const { vertices, indices } = modelTriangles(object);
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return { count: 0, volumes: [], capped: false };
  const lo: [number, number, number] = [0, 0, 0];
  const dim: [number, number, number] = [0, 0, 0];
  for (let a = 0; a < 3; a++) {
    // A voxel centre is at (k + 0.5) * voxel: the k range whose centre lies
    // inside the model's own bounds.
    lo[a] = Math.ceil((box.min.getComponent(a) - voxel / 2) / voxel - 1e-9);
    const hi = Math.floor((box.max.getComponent(a) - voxel / 2) / voxel + 1e-9);
    dim[a] = Math.max(0, hi - lo[a] + 1);
  }
  if (!dim[0] || !dim[1] || !dim[2]) return { count: 0, volumes: [], capped: false };

  const inside = new Set<number>();
  const at = (x: number, y: number, z: number) => (z * dim[1] + y) * dim[0] + x;
  const centre = new THREE.Vector3();
  for (let z = 0; z < dim[2]; z++) {
    for (let y = 0; y < dim[1]; y++) {
      for (let x = 0; x < dim[0]; x++) {
        centre.set(
          (lo[0] + x + 0.5) * voxel,
          (lo[1] + y + 0.5) * voxel,
          (lo[2] + z + 0.5) * voxel,
        );
        if (!insideModel(vertices, indices, centre)) continue;
        inside.add(at(x, y, z));
        if (inside.size > maxVoxels) return { count: inside.size, volumes: [], capped: true };
      }
    }
  }

  // Greedy merge: grow a run along x, then z, then y, never past 32 voxels
  // on an axis (3.2 m at 0.1 m) and never into a voxel already used.
  const used = new Set<number>();
  const volumes: PieceVolume[] = [];
  const limit = Math.max(1, Math.round(MAX_MODEL_VOLUME / voxel));
  for (let z = 0; z < dim[2]; z++) {
    for (let y = 0; y < dim[1]; y++) {
      for (let x = 0; x < dim[0]; x++) {
        const start = at(x, y, z);
        if (!inside.has(start) || used.has(start)) continue;
        let sx = 1, sy = 1, sz = 1;
        const free = (ax: number, ay: number, az: number) => {
          const cell = at(ax, ay, az);
          return inside.has(cell) && !used.has(cell);
        };
        while (sx < limit && x + sx < dim[0] && free(x + sx, y, z)) sx++;
        while (sz < limit && z + sz < dim[2] && (() => {
          for (let i = 0; i < sx; i++) if (!free(x + i, y, z + sz)) return false;
          return true;
        })()) sz++;
        while (sy < limit && y + sy < dim[1] && (() => {
          for (let k = 0; k < sz; k++) for (let i = 0; i < sx; i++) if (!free(x + i, y + sy, z + k)) return false;
          return true;
        })()) sy++;
        for (let k = 0; k < sz; k++) for (let j = 0; j < sy; j++) for (let i = 0; i < sx; i++) {
          used.add(at(x + i, y + j, z + k));
        }
        const low: Vec3 = [
          (lo[0] + x) * voxel,
          (lo[1] + y) * voxel,
          (lo[2] + z) * voxel,
        ];
        volumes.push(boxOf(low, [sx, sy, sz], voxel, material));
      }
    }
  }
  return { count: inside.size, volumes, capped: false };
}
