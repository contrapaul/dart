import { CHUNK_SIZE, Chunk, type VoxelVolume } from "./chunk";

// Greedy meshing: for each axis and direction, find the voxel faces that
// touch empty space, then merge runs of the same material into rectangles.
// A flat wall of one material becomes a handful of quads instead of
// thousands. Runs in a Web Worker (mesher.worker.ts); pure so it can be tested.

const S = CHUNK_SIZE;
/** A chunk plus a one-voxel border from its six face neighbours. */
export const PAD = S + 2;

export function paddedIndex(x: number, y: number, z: number) {
  return x + 1 + (z + 1) * PAD + (y + 1) * PAD * PAD;
}

export interface MeshData {
  /** Vertex positions in voxel units, relative to the chunk's corner. */
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
}

/** Copy a chunk and its face-neighbour border into a padded array. */
export function buildPadded(volume: VoxelVolume, cx: number, cy: number, cz: number, chunk: Chunk) {
  const out = new Uint8Array(PAD ** 3);
  const d = chunk.data;
  for (let y = 0; y < S; y++)
    for (let z = 0; z < S; z++) {
      const src = Chunk.index(0, y, z);
      out.set(d.subarray(src, src + S), paddedIndex(0, y, z));
    }
  const ox = cx * S, oy = cy * S, oz = cz * S;
  for (let a = 0; a < S; a++)
    for (let b = 0; b < S; b++) {
      out[paddedIndex(-1, a, b)] = volume.get(ox - 1, oy + a, oz + b);
      out[paddedIndex(S, a, b)] = volume.get(ox + S, oy + a, oz + b);
      out[paddedIndex(a, -1, b)] = volume.get(ox + a, oy - 1, oz + b);
      out[paddedIndex(a, S, b)] = volume.get(ox + a, oy + S, oz + b);
      out[paddedIndex(a, b, -1)] = volume.get(ox + a, oy + b, oz - 1);
      out[paddedIndex(a, b, S)] = volume.get(ox + a, oy + b, oz + S);
    }
  return out;
}

// Growable typed buffers, reused between calls in the same worker.
let pos = new Float32Array(1 << 16);
let nrm = new Float32Array(1 << 16);
let col = new Float32Array(1 << 16);
let idx = new Uint32Array(1 << 15);
function grow<T extends Float32Array | Uint32Array>(a: T, need: number): T {
  if (need <= a.length) return a;
  let n = a.length;
  while (n < need) n *= 2;
  const b = new (a.constructor as new (n: number) => T)(n);
  b.set(a);
  return b;
}

/** colors: linear RGB per material id (see linearColorTable). */
export function greedyMesh(vox: Uint8Array, colors: Float32Array): MeshData {
  const mask = new Uint8Array(S * S);
  const x = [0, 0, 0];
  const q = [0, 0, 0];
  let nv = 0; // vertices written
  let ni = 0; // indices written

  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3;
    const v = (d + 2) % 3;
    for (const dir of [-1, 1]) {
      q[0] = q[1] = q[2] = 0;
      q[d] = dir;
      for (x[d] = 0; x[d] < S; x[d]++) {
        // Mask of faces on this slice: material id where a solid voxel faces empty space.
        let n = 0;
        for (x[v] = 0; x[v] < S; x[v]++)
          for (x[u] = 0; x[u] < S; x[u]++, n++) {
            const a = vox[paddedIndex(x[0], x[1], x[2])];
            mask[n] = a !== 0 && vox[paddedIndex(x[0] + q[0], x[1] + q[1], x[2] + q[2])] === 0 ? a : 0;
          }

        // Merge into rectangles.
        n = 0;
        for (let j = 0; j < S; j++)
          for (let i = 0; i < S; ) {
            const m = mask[n];
            if (m === 0) {
              i++;
              n++;
              continue;
            }
            let w = 1;
            while (i + w < S && mask[n + w] === m) w++;
            let h = 1;
            grow: for (; j + h < S; h++)
              for (let k = 0; k < w; k++) if (mask[n + k + h * S] !== m) break grow;

            // Quad corners. The face sits on the far side of the voxel for +dir.
            const base = [0, 0, 0];
            base[d] = x[d] + (dir > 0 ? 1 : 0);
            base[u] = i;
            base[v] = j;
            const du = [0, 0, 0];
            du[u] = w;
            const dv = [0, 0, 0];
            dv[v] = h;

            pos = grow(pos, (nv + 4) * 3);
            nrm = grow(nrm, (nv + 4) * 3);
            col = grow(col, (nv + 4) * 3);
            idx = grow(idx, ni + 6);
            const corners = [
              [base[0], base[1], base[2]],
              [base[0] + du[0], base[1] + du[1], base[2] + du[2]],
              [base[0] + du[0] + dv[0], base[1] + du[1] + dv[1], base[2] + du[2] + dv[2]],
              [base[0] + dv[0], base[1] + dv[1], base[2] + dv[2]],
            ];
            for (let c = 0; c < 4; c++) {
              const o = (nv + c) * 3;
              pos[o] = corners[c][0];
              pos[o + 1] = corners[c][1];
              pos[o + 2] = corners[c][2];
              nrm[o] = q[0];
              nrm[o + 1] = q[1];
              nrm[o + 2] = q[2];
              col[o] = colors[m * 3];
              col[o + 1] = colors[m * 3 + 1];
              col[o + 2] = colors[m * 3 + 2];
            }
            // u x v = d, so this order faces +d; flip it for -d.
            if (dir > 0) idx.set([nv, nv + 1, nv + 2, nv, nv + 2, nv + 3], ni);
            else idx.set([nv, nv + 2, nv + 1, nv, nv + 3, nv + 2], ni);
            nv += 4;
            ni += 6;

            for (let l = 0; l < h; l++) mask.fill(0, n + l * S, n + l * S + w);
            i += w;
            n += w;
          }
      }
    }
  }

  return {
    positions: pos.slice(0, nv * 3),
    normals: nrm.slice(0, nv * 3),
    colors: col.slice(0, nv * 3),
    indices: idx.slice(0, ni),
  };
}
