import { CHUNK_SIZE, Chunk, type VoxelVolume } from "./chunk";
import renderJson from "../../data/render.json";

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

/** Copy a chunk and its one-voxel border (faces, edges and corners) into a
 * padded array. */
export function buildPadded(volume: VoxelVolume, cx: number, cy: number, cz: number, chunk: Chunk) {
  const out = new Uint8Array(PAD ** 3);
  const d = chunk.data;
  for (let y = 0; y < S; y++)
    for (let z = 0; z < S; z++) {
      const src = Chunk.index(0, y, z);
      out.set(d.subarray(src, src + S), paddedIndex(0, y, z));
    }
  const ox = cx * S, oy = cy * S, oz = cz * S;
  const edge = (n: number) => n === -1 || n === S;
  for (let a = -1; a <= S; a++)
    for (let b = -1; b <= S; b++)
      for (let c = -1; c <= S; c++) {
        if (!edge(a) && !edge(b) && !edge(c)) continue;
        out[paddedIndex(a, b, c)] = volume.get(ox + a, oy + b, oz + c);
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

/** colors: linear RGB per material id (see linearColorTable).
 *  aoLevels: brightness at 0, 1, 2, 3 open sides (default: data/render.json). */
export function greedyMesh(vox: Uint8Array, colors: Float32Array, aoLevels: number[] = renderJson.ao.levels): MeshData {
  const mask = new Uint16Array(S * S);
  const x = [0, 0, 0];
  const q = [0, 0, 0];
  const su = [0, 0, 0];
  const sv = [0, 0, 0];
  let nv = 0; // vertices written
  let ni = 0; // indices written

  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3;
    const v = (d + 2) % 3;
    for (const dir of [-1, 1]) {
      q[0] = q[1] = q[2] = 0;
      q[d] = dir;
      su[u] = 1; su[v] = 0;
      sv[u] = 0; sv[v] = 1;
      // Offsets in the padded array for one step along the face's u and v
      // axes, and the normal direction.
      const offQ = dir * (d === 0 ? 1 : d === 2 ? PAD : PAD * PAD);
      const offU = u === 0 ? 1 : u === 2 ? PAD : PAD * PAD;
      const offV = v === 0 ? 1 : v === 2 ? PAD : PAD * PAD;
      for (x[d] = 0; x[d] < S; x[d]++) {
        // Mask of faces on this slice: the lower 8 bits hold the material id
        // and the next 8 bits hold the AO (0 to 3 open sides, 2 bits each) of
        // the voxel's four face corners, where a solid voxel faces empty space.
        let n = 0;
        for (x[v] = 0; x[v] < S; x[v]++)
          for (x[u] = 0; x[u] < S; x[u]++, n++) {
            const pi = paddedIndex(x[0], x[1], x[2]);
            const a = vox[pi];
            if (a === 0 || vox[pi + offQ] !== 0) {
              mask[n] = 0;
              continue;
            }
            // The layer in front of the face. Each corner looks at its two
            // side cells and the diagonal cell there: both sides solid
            // occludes fully, otherwise 3 minus the number of solid cells.
            const t1 = vox[pi + offQ - offU] !== 0 ? 1 : 0;
            const t2 = vox[pi + offQ + offU] !== 0 ? 1 : 0;
            const t3 = vox[pi + offQ - offV] !== 0 ? 1 : 0;
            const t4 = vox[pi + offQ + offV] !== 0 ? 1 : 0;
            // Corner order the way the quad writes them: base, +u, +u+v, +v.
            const c1 = vox[pi + offQ - offU - offV] !== 0 ? 1 : 0;
            const c2 = vox[pi + offQ + offU - offV] !== 0 ? 1 : 0;
            const c3 = vox[pi + offQ + offU + offV] !== 0 ? 1 : 0;
            const c4 = vox[pi + offQ - offU + offV] !== 0 ? 1 : 0;
            mask[n] =
              a |
              ((t1 & t3 ? 0 : 3 - t1 - t3 - c1) << 8) |
              ((t2 & t3 ? 0 : 3 - t2 - t3 - c2) << 10) |
              ((t2 & t4 ? 0 : 3 - t2 - t4 - c3) << 12) |
              ((t1 & t4 ? 0 : 3 - t1 - t4 - c4) << 14);
          }

        n = 0;
        for (let j = 0; j < S; j++)
          for (let i = 0; i < S; ) {
            const m = mask[n];
            if (m === 0) {
              i++;
              n++;
              continue;
            }
            const n0 = n;
            let w = 1;
            while (i + w < S && mask[n + w] === m) w++;
            let h = 1;
            grow: for (; j + h < S; h++)
              for (let k = 0; k < w; k++) if (mask[n + k + h * S] !== m) break grow;

            const mat = m & 0xff;
            // AO at the quad's four corner voxels (corner 2 bits each).
            const a0 = (mask[n0] >> 8) & 3;
            const a1 = (mask[n0 + w - 1] >> 10) & 3;
            const a2 = (mask[n0 + w - 1 + (h - 1) * S] >> 12) & 3;
            const a3 = (mask[n0 + (h - 1) * S] >> 14) & 3;
            const aoAt = [aoLevels[a0], aoLevels[a1], aoLevels[a2], aoLevels[a3]];

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
              col[o] = colors[mat * 3] * aoAt[c];
              col[o + 1] = colors[mat * 3 + 1] * aoAt[c];
              col[o + 2] = colors[mat * 3 + 2] * aoAt[c];
            }
            // u x v = d, so this order faces +d; flip it for -d.
            // If corners 0 and 2 are darker than 1 and 3, split along the
            // 1-3 diagonal instead, so the shading does not show a crease.
            const flipped = a0 + a2 < a1 + a3;
            if (dir > 0) idx.set(flipped ? [nv + 1, nv + 2, nv + 3, nv, nv + 1, nv + 3] : [nv, nv + 1, nv + 2, nv, nv + 2, nv + 3], ni);
            else idx.set(flipped ? [nv + 3, nv + 2, nv + 1, nv + 3, nv + 1, nv] : [nv, nv + 2, nv + 1, nv, nv + 3, nv + 2], ni);
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
