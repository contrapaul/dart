import type { VoxelVolume } from "./chunk";
import { EMPTY, material } from "./materials";
import tuning from "../../data/destruction.json";

// Remove voxels in a sphere. Harder materials shrink the sphere for that
// material: a voxel goes if its distance from the centre is within
// radius / hardness. If radius / hardness is under minEffectiveRadius the
// hit only scuffs the material and nothing is removed. Indestructible
// voxels never go.

export interface RemovedVoxel {
  x: number;
  y: number;
  z: number;
  material: number;
}

/** Centre and radius in voxel units. Returns the voxels removed. */
export function carveSphere(volume: VoxelVolume, cx: number, cy: number, cz: number, radius: number) {
  const removed: RemovedVoxel[] = [];
  const minR = tuning.carve.minEffectiveRadius;
  const r = Math.ceil(radius);
  // Voxel (x, y, z) spans [x, x+1); measure from its centre.
  const bx = Math.floor(cx), by = Math.floor(cy), bz = Math.floor(cz);
  for (let y = by - r; y <= by + r; y++)
    for (let z = bz - r; z <= bz + r; z++)
      for (let x = bx - r; x <= bx + r; x++) {
        const m = volume.get(x, y, z);
        if (m === EMPTY) continue;
        const mat = material(m);
        if (!mat || mat.indestructible) continue;
        const eff = radius / mat.hardness;
        if (eff < minR) continue;
        const d2 = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 + (z + 0.5 - cz) ** 2;
        if (d2 > eff * eff) continue;
        volume.set(x, y, z, EMPTY);
        removed.push({ x, y, z, material: m });
      }
  return removed;
}
