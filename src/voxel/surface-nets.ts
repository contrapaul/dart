import { CHUNK_SIZE } from "./chunk";
import { paddedIndex, type MeshData } from "./mesher";
import renderJson from "../../data/render.json";

// Smoothed meshing for Foamer volumes (ENG-09, PLAN.md 7.4): naive surface
// nets with relaxation. Each cell (the cube between eight voxel centres)
// that the surface passes through gets one vertex, first at the mean of
// its crossing edges, then relaxed toward its mesh neighbours a few times
// while staying inside its cell. Every solid voxel still makes geometry, so
// small details (eyes, a one-voxel ridge) survive, and a carve still shows.
// Runs in the mesher worker on the same padded input as greedyMesh.
//
// Limit: relaxation does not see across chunk seams, so a smoothed volume
// should fit in one chunk (a Foamer does). Walls stay greedy meshed.

const S = CHUNK_SIZE;
/** Cells have their lower corner at -1..S-1 on each axis. */
const C = S + 1;
const cellIndex = (x: number, y: number, z: number) => x + 1 + (z + 1) * C + (y + 1) * C * C;

// The 12 edges of a cell as pairs of corner numbers; corner k is at
// (k & 1, (k >> 1) & 1, (k >> 2) & 1).
const EDGES = [
  [0, 1], [2, 3], [4, 5], [6, 7],
  [0, 2], [1, 3], [4, 6], [5, 7],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

/** colors: linear RGB per material id. iterations: relaxation passes. */
export function surfaceNets(
  vox: Uint8Array,
  colors: Float32Array,
  iterations: number = renderJson.smooth.iterations,
): MeshData {
  const solid = (x: number, y: number, z: number) => vox[paddedIndex(x, y, z)] !== 0;
  const cellVert = new Int32Array(C * C * C).fill(-1);
  const pos: number[] = [];
  const lo: number[] = []; // cell lower corner, in position units
  const col: number[] = [];
  const corner = [0, 0, 0, 0, 0, 0, 0, 0];

  // 1. One vertex per cell the surface crosses.
  for (let y = -1; y < S; y++)
    for (let z = -1; z < S; z++)
      for (let x = -1; x < S; x++) {
        let mask = 0;
        for (let k = 0; k < 8; k++) {
          corner[k] = vox[paddedIndex(x + (k & 1), y + ((k >> 1) & 1), z + ((k >> 2) & 1))];
          if (corner[k] !== 0) mask |= 1 << k;
        }
        if (mask === 0 || mask === 255) continue;
        // Mean of the crossing edges' midpoints, in cell-local units.
        let sx = 0, sy = 0, sz = 0, n = 0;
        for (const [a, b] of EDGES) {
          if (((mask >> a) & 1) === ((mask >> b) & 1)) continue;
          sx += ((a & 1) + (b & 1)) / 2;
          sy += (((a >> 1) & 1) + ((b >> 1) & 1)) / 2;
          sz += (((a >> 2) & 1) + ((b >> 2) & 1)) / 2;
          n++;
        }
        // Voxel centres sit at i + 0.5 in position units.
        const ox = x + 0.5, oy = y + 0.5, oz = z + 0.5;
        cellVert[cellIndex(x, y, z)] = pos.length / 3;
        pos.push(ox + sx / n, oy + sy / n, oz + sz / n);
        lo.push(ox, oy, oz);
        // Colour: the most common material among the surface corners (solid
        // and next to an empty corner along a cell edge), so the eye voxels
        // win over the lime voxels behind them.
        let best = 0, bestCount = 0;
        for (let k = 0; k < 8; k++) {
          const m = corner[k];
          if (m === 0 || m === best) continue;
          let count = 0;
          for (let j = 0; j < 8; j++)
            if (corner[j] === m && (corner[j ^ 1] === 0 || corner[j ^ 2] === 0 || corner[j ^ 4] === 0)) count++;
          if (count > bestCount) {
            best = m;
            bestCount = count;
          }
        }
        col.push(colors[best * 3], colors[best * 3 + 1], colors[best * 3 + 2]);
      }

  // 2. One quad per edge between a solid and an empty voxel, joining the
  // four cells around that edge. This chunk owns edges whose lower voxel
  // is inside it along the edge's axis.
  const idx: number[] = [];
  const neighbours: number[][] = Array.from({ length: pos.length / 3 }, () => []);
  const link = (a: number, b: number) => {
    if (!neighbours[a].includes(b)) neighbours[a].push(b);
    if (!neighbours[b].includes(a)) neighbours[b].push(a);
  };
  const p = [0, 0, 0];
  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3;
    const v = (d + 2) % 3;
    for (p[1] = -1; p[1] < S; p[1]++)
      for (p[2] = -1; p[2] < S; p[2]++)
        for (p[0] = -1; p[0] < S; p[0]++) {
          if (p[d] < 0 || p[u] < 0 || p[v] < 0) continue;
          const a = solid(p[0], p[1], p[2]);
          const b = solid(p[0] + (d === 0 ? 1 : 0), p[1] + (d === 1 ? 1 : 0), p[2] + (d === 2 ? 1 : 0));
          if (a === b) continue;
          // The four cells around the edge: lower corners at p minus 0 or 1
          // along u and v, in order around the edge.
          const q = [0, 0, 0, 0];
          const offs = [[0, 0], [1, 0], [1, 1], [0, 1]];
          for (let k = 0; k < 4; k++) {
            const c = [p[0], p[1], p[2]];
            c[u] -= offs[k][0];
            c[v] -= offs[k][1];
            q[k] = cellVert[cellIndex(c[0], c[1], c[2])];
          }
          // Around the edge, q0..q3 sit at (+u,+v), (-u,+v), (-u,-v), (+u,-v)
          // of it: counter-clockwise about +d, so that order faces +d. The
          // face points from solid to empty.
          if (a) idx.push(q[0], q[1], q[2], q[0], q[2], q[3]);
          else idx.push(q[0], q[3], q[2], q[0], q[2], q[1]);
          for (let k = 0; k < 4; k++) link(q[k], q[(k + 1) % 4]);
        }
  }

  // 3. Relax: move each vertex toward the mean of its neighbours, clamped
  // to its own cell so the surface never leaves the voxels that made it.
  const nv = pos.length / 3;
  const next = new Float64Array(pos.length);
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < nv; i++) {
      const nb = neighbours[i];
      for (let axis = 0; axis < 3; axis++) {
        let s = 0;
        for (const j of nb) s += pos[j * 3 + axis];
        const mean = nb.length ? s / nb.length : pos[i * 3 + axis];
        const l = lo[i * 3 + axis];
        next[i * 3 + axis] = Math.min(l + 1, Math.max(l, mean));
      }
    }
    for (let i = 0; i < pos.length; i++) pos[i] = next[i];
  }

  // 4. Smooth normals: area-weighted sum of the faces around each vertex.
  const nrm = new Float32Array(pos.length);
  for (let t = 0; t < idx.length; t += 3) {
    const i0 = idx[t] * 3, i1 = idx[t + 1] * 3, i2 = idx[t + 2] * 3;
    const ax = pos[i1] - pos[i0], ay = pos[i1 + 1] - pos[i0 + 1], az = pos[i1 + 2] - pos[i0 + 2];
    const bx = pos[i2] - pos[i0], by = pos[i2 + 1] - pos[i0 + 1], bz = pos[i2 + 2] - pos[i0 + 2];
    const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    for (const i of [i0, i1, i2]) {
      nrm[i] += nx;
      nrm[i + 1] += ny;
      nrm[i + 2] += nz;
    }
  }
  for (let i = 0; i < nrm.length; i += 3) {
    const l = Math.hypot(nrm[i], nrm[i + 1], nrm[i + 2]) || 1;
    nrm[i] /= l;
    nrm[i + 1] /= l;
    nrm[i + 2] /= l;
  }

  return {
    positions: new Float32Array(pos),
    normals: nrm,
    colors: new Float32Array(col),
    indices: new Uint32Array(idx),
  };
}
