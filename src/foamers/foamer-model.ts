import type { VoxelVolume } from "../voxel/chunk";
import { materialId } from "../voxel/materials";

// The placeholder test Foamer (GAME-03): a rounded blob with a flattened
// bottom and two big friendly eyes on its +z face. Paul designs the real
// looks (PLAN.md 4.2), so nothing here is meant to survive that.

const LIME = materialId("foam-lime");
const EYE = materialId("foam-white");
const INK = materialId("foam-ink");

/** Fill voxels 0..size-1 on each axis with the placeholder test Foamer.
 *  It faces +z. */
export function buildTestFoamer(volume: VoxelVolume, size: [number, number, number]): void {
  const [sx, sy, sz] = size;
  const cx = (sx - 1) / 2;
  const cy = (sy - 1) / 2;
  const cz = (sz - 1) / 2;
  // Eye centres, at half-integer x so the pair mirrors about the box centre
  // (x mirrors about cx + 0.5). Two thirds of the way up, at a half-integer
  // y so the pupils land on a 2 x 2 of voxels.
  const ex = cx - 2;
  const ey = Math.floor((2 / 3) * sy) - 0.5;
  const eyeRadius = 2; // disc about 4 voxels across
  const eyes: number[] = [ex, sx - 1 - ex];
  for (let y = 0; y < sy; y++) {
    for (let z = 0; z < sz; z++) {
      for (let x = 0; x < sx; x++) {
        // Ellipsoid centred in the box, radii half the size on each axis.
        const dx = (x - cx) / (sx / 2);
        const dy = (y - cy) / (sy / 2);
        const dz = (z - cz) / (sz / 2);
        let m = dx * dx + dy * dy + dz * dz <= 1 ? LIME : 0;
        // Flatten the bottom: fill the bottom two layers inside the
        // ellipse's footprint, so the blob stands.
        if (y < 2 && dx * dx + dz * dz <= 1) m = LIME;
        if (m !== 0 && z === sz - 2) {
          // Eyes on the +z face, set one voxel into the surface so they are
          // flush: a disc of foam-white, a 2 x 2 foam-ink pupil.
          for (const e of eyes) {
            const d2 = (x - e) ** 2 + (y - ey) ** 2;
            if (d2 <= eyeRadius * eyeRadius) m = EYE;
            if (Math.abs(x - e) <= 0.5 && Math.abs(y - ey) <= 0.5) m = INK;
          }
        }        if (m !== 0) volume.set(x, y, z, m);
      }
    }
  }
}
