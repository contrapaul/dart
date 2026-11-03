import * as THREE from "three";
import type { RemovedVoxel } from "../voxel/carve";

// Wiring both game pages share. Small on purpose: only what would
// otherwise be copied line for line between src/main.ts and the arena page
// lives here, and each page keeps its own level, HUD and restart rules.

/** Everything a carve source needs to hand its removed voxels to the nav
 *  grid: the mesh they came from, in that mesh's own voxel coordinates. */
export interface CarveMesh {
  voxelToWorld(v: THREE.Vector3): THREE.Vector3;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/** The world-space box a carve covered, as [minX, minZ, maxX, maxZ]. The
 *  grid re-bakes only that patch (ENG-08 stage 3b). A carve that removed
 *  nothing is not a change, so the caller skips it. */
export function carveBounds(
  mesh: CarveMesh, removed: RemovedVoxel[],
): [number, number, number, number] | null {
  if (removed.length === 0) return null;
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const v of removed) {
    if (v.x < x0) x0 = v.x;
    if (v.x > x1) x1 = v.x;
    if (v.z < z0) z0 = v.z;
    if (v.z > z1) z1 = v.z;
  }
  const a = mesh.voxelToWorld(_a.set(x0, 0, z0));
  const b = mesh.voxelToWorld(_b.set(x1, 0, z1));
  return [a.x, a.z, b.x, b.z];
}

/** A level's "you fell out of the world" test: below this the player is
 *  teleported back to the start or the arena's entry. */
export const FALL_LIMIT = -20;
